"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePen, Inbox, Send, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import {
  List,
  useListRef,
  type RowComponentProps,
} from "react-window";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmailCommandContextMenu,
  type EmailCommandRuntime,
} from "@/email/commands";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import {
  formatDate,
  itemKey,
  messageHref,
  previewText,
} from "./mail-list-helpers";
import type { MailListItem } from "@/email/components/mailbox/types";
import {
  threadUnreadKeys,
  type ConversationThread,
} from "@/email/lib/threading/conversation-threading";
import { trimQuotedHistoryForThread } from "@/email/lib/reply/reply-quote-body";
import { formatSenderDisplay, splitRecipients } from "@/lib/email/format-sender";
import { extractFirstEmail, SenderAvatar } from "@/email/components/sender/SenderAvatar";
import { SenderHoverCard, SenderHoverLabel } from "@/email/components/sender/SenderHoverCard";
import type { ListItemStateStore } from "@/email/stores/list-item-state-store";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

type MailListFolder = "inbox" | "drafts" | "sent" | "trash";

/** EmailTableRow: size-7 avatar (28) + py-2 (16) + bottom border (1). */
const MAIL_ROW_HEIGHT = 45;
/** Start fetching the next page this many rows before the end. */
const LOAD_MORE_THRESHOLD = 10;
/**
 * Multiplier of the visible viewport height to keep rendered on each side
 * of the scroll window. react-window unmounts rows outside the visible +
 * overscan region; with the previous fixed overscanCount of 8 (~360px) the
 * mail list would visibly blank out already-rendered rows during momentum
 * scroll because they were unmounted and had to re-mount on the way back.
 * Keeping ~1 viewport of overscan on each side (≈3 viewports mounted total)
 * balances scroll smoothness against the per-row render cost (hover cards,
 * command menu resolution, preview trimming).
 */
const OVERSCAN_VIEWPORTS = 1;
/** Minimum overscan rows (used before the container has been measured). */
const MIN_OVERSCAN_ROWS = 8;
/**
 * How many skeleton placeholder rows to render at the bottom while a page
 * is being fetched. The list is append-only (no gap rows in the middle), so
 * the only genuinely-unloaded region is the next page; these skeletons give
 * immediate visual feedback that more is coming instead of a single text
 * sentinel or a blank gap.
 */
const PLACEHOLDER_ROWS = 8;

const FOLDER_TITLES: Record<MailListFolder, string> = {
  inbox: "Inbox",
  drafts: "Drafts",
  sent: "Sent",
  trash: "Trash",
};

export type MailListPaneProps = {
  folder: MailListFolder;
  items: MailListItem[];
  messageId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  folderBase: string;
  accountFilter: string;
  threadByInboundKey: Map<string, ConversationThread>;
  composeNewHref: string;
  relaybaseOk: boolean;
  emptyTrash: () => void;
  isUnread: (key: string) => boolean;
  commandRuntimeFor: (item: MailListItem) => EmailCommandRuntime;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Whole-mailbox total for the header (null hides the count). */
  totalCount?: number | null;
  /** Whole-mailbox unread for the header (shown when > 0). */
  unreadCount?: number | null;
  /** Server search: total matches (null when search is inactive). */
  searchTotal?: number | null;
  searchLoading?: boolean;
  /**
   * MobX store holding the keyboard-navigation focus anchor for this
   * folder. Updated by row hover and the visible-top fallback; consumed
   * by `useMailListKeyboard` to resolve the "current" row when no URL
   * selection exists.
   */
  listItemStateStore?: ListItemStateStore;
};

type MailRowProps = {
  items: MailListItem[];
  folder: MailListFolder;
  messageId?: string;
  folderBase: string;
  accountFilter: string;
  threadByInboundKey: Map<string, ConversationThread>;
  isUnread: (key: string) => boolean;
  commandRuntimeFor: (item: MailListItem) => EmailCommandRuntime;
  loadingMore: boolean;
  hasMore: boolean;
  listItemStateStore?: ListItemStateStore;
};

/**
 * Skeleton placeholder rendered for rows beyond the loaded items while a
 * page is being fetched. Mirrors the EmailTableRow grid layout (avatar +
 * primary line + subject/preview line + date) so the loading region reads
 * as "more rows coming" rather than a blank gap.
 */
function MailRowSkeleton({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={style}
      className="grid w-full animate-pulse gap-3 border-b border-border/20 px-4 py-2 text-left text-sm grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto]"
      aria-hidden
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-7 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <span className="block h-3 w-3/4 rounded bg-muted" />
          <span className="block h-2.5 w-1/2 rounded bg-muted/70" />
        </div>
      </div>
      <div className="min-w-0 space-y-1.5 self-center">
        <span className="block h-3 w-2/3 rounded bg-muted" />
        <span className="block h-2.5 w-full rounded bg-muted/70" />
      </div>
      <span className="h-3 w-12 shrink-0 self-center rounded bg-muted" />
    </div>
  );
}

/**
 * Virtualized row. `memo(observer(...))` so react-window scroll repositioning
 * does not force every visible row to re-render on every scroll frame. The
 * `memo` shallow-compares props (index, style, rowProps) and skips re-renders
 * when they are unchanged. Per-row work (recipient parsing, date formatting,
 * preview trimming, command-runtime construction, hover-card element creation)
 * runs inline but only when the row actually re-renders (item change,
 * selection change, etc.), not on every scroll tick.
 */
const MailRow = memo(
  observer(function MailRow({
    index,
    style,
    items,
    folder,
    messageId,
    folderBase,
    accountFilter,
    threadByInboundKey,
    isUnread,
    commandRuntimeFor,
    loadingMore,
    hasMore,
    listItemStateStore,
  }: RowComponentProps<MailRowProps>): React.ReactElement | null {
    const item = items[index];
    if (!item) {
      // Past the last loaded item: skeleton while fetching, sentinel hint
      // when more pages exist but we haven't started loading the next one.
      if (loadingMore) {
        return <MailRowSkeleton style={style} />;
      }
      if (!hasMore) {
        return null;
      }
      return (
        <div
          style={style}
          className="flex items-center justify-center text-xs text-muted-foreground"
        >
          Scroll to load more
        </div>
      );
    }

    const rowKey = itemKey(item);
    const onMouseEnter = listItemStateStore
      ? () => listItemStateStore.setFocus(rowKey, "hover")
      : undefined;

    if (item.kind === "draft") {
      const firstRecipient = splitRecipients(item.message.to)[0];
      const recipientName = firstRecipient?.name;
      const recipientEmail =
        firstRecipient?.email ?? extractFirstEmail(item.message.to);
      const primary = item.message.to || "(no recipient)";
      const subject = item.message.subject || "(no subject)";
      const date = formatDate(item.message.updatedAt);
      const preview = previewText(item);
      const isSelected = item.message.id === messageId;
      const href = messageHref(folderBase, item, accountFilter);
      const runtime = commandRuntimeFor(item);
      const avatar = (
        <SenderHoverCard
          fromEmail={recipientEmail}
          triggerClassName="size-7"
        >
          <SenderAvatar fromEmail={recipientEmail} />
        </SenderHoverCard>
      );
      const primaryLabel = (
        <SenderHoverLabel
          fromName={recipientName}
          fromEmail={recipientEmail}
        >
          {primary}
        </SenderHoverLabel>
      );
      const status = item.message.replyKey
        ? "Reply"
        : item.message.forwardKey
          ? "Forward"
          : "Draft";
      return (
        <div style={style} className="overflow-hidden" onMouseEnter={onMouseEnter}>
          <EmailCommandContextMenu runtime={runtime}>
            <EmailTableRow
              href={href}
              selected={isSelected}
              primary={primaryLabel}
              subject={subject}
              preview={preview}
              date={date}
              avatar={avatar}
              status={
                <Badge variant="secondary" className="text-[10px]">
                  {status}
                </Badge>
              }
            />
          </EmailCommandContextMenu>
        </div>
      );
    }

    const isInbox = item.kind === "inbox";
    const thread =
      isInbox && folder === "inbox"
        ? threadByInboundKey.get(item.message.key) ?? null
        : null;
    const firstRecipient = isInbox ? undefined : splitRecipients(item.message.to)[0];
    const recipientEmail = isInbox
      ? undefined
      : (firstRecipient?.email ?? extractFirstEmail(item.message.to));
    const recipientName = isInbox ? undefined : firstRecipient?.name;
    const primary = isInbox
      ? (thread?.participantLabel ??
        formatSenderDisplay(item.message.fromName, item.message.fromEmail))
      : item.message.to;
    const senderName = isInbox ? item.message.fromName : undefined;
    const senderEmail = isInbox ? item.message.fromEmail : recipientEmail;
    const subject = thread?.subject ?? item.message.subject;
    const attachmentCount = isInbox
      ? item.message.attachmentCount ?? item.message.attachments?.length ?? 0
      : 0;
    const date = formatDate(
      thread?.latestAt ??
        (isInbox ? item.message.receivedAt : item.message.sentAt),
    );
    const previewRaw = thread?.preview || previewText(item);
    const preview = trimQuotedHistoryForThread({
      bodyText: previewRaw,
    }).bodyText.replace(/\s+/g, " ").trim();
    const isSelected =
      isInbox && folder === "inbox" && thread && messageId
        ? thread.inboundKeys.includes(messageId)
        : itemKey(item) === messageId;
    const unread =
      isInbox && folder === "inbox"
        ? thread
          ? threadUnreadKeys(thread, isUnread).length > 0
          : isUnread(item.message.key)
        : undefined;
    const stackCount =
      thread && thread.messageCount > 1 ? thread.messageCount : undefined;
    const href = messageHref(folderBase, item, accountFilter);
    const runtime = commandRuntimeFor(item);
    const avatar = isInbox ? (
      <SenderHoverCard
        fromName={item.message.fromName}
        fromEmail={item.message.fromEmail}
        triggerClassName="size-7"
      >
        <SenderAvatar
          fromName={item.message.fromName}
          fromEmail={item.message.fromEmail}
          unread={unread}
        />
      </SenderHoverCard>
    ) : (
      <SenderHoverCard
        fromEmail={recipientEmail}
        triggerClassName="size-7"
      >
        <SenderAvatar fromEmail={recipientEmail} />
      </SenderHoverCard>
    );
    const primaryLabel =
      folder === "trash" ? (
        <>
          {isInbox ? "In" : "Sent"} ·{" "}
          <SenderHoverLabel
            fromName={isInbox ? senderName : recipientName}
            fromEmail={senderEmail}
          >
            {primary}
          </SenderHoverLabel>
        </>
      ) : (
        <SenderHoverLabel
          fromName={isInbox ? senderName : recipientName}
          fromEmail={senderEmail}
        >
          {primary}
        </SenderHoverLabel>
      );
    return (
      <div style={style} className="overflow-hidden" onMouseEnter={onMouseEnter}>
        <EmailCommandContextMenu runtime={runtime}>
          <EmailTableRow
            href={href}
            selected={isSelected}
            unread={unread}
            avatar={avatar}
            primary={primaryLabel}
            subject={subject || "(no subject)"}
            stackCount={stackCount}
            subjectAddon={
              attachmentCount > 0 ? ` (${attachmentCount})` : undefined
            }
            preview={preview}
            date={date}
          />
        </EmailCommandContextMenu>
      </div>
    );
  }),
);

export function MailListPane({
  folder,
  items,
  messageId,
  search,
  onSearchChange,
  folderBase,
  accountFilter,
  threadByInboundKey,
  composeNewHref,
  relaybaseOk,
  emptyTrash,
  isUnread,
  commandRuntimeFor,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  totalCount = null,
  unreadCount = null,
  searchTotal = null,
  searchLoading = false,
  listItemStateStore,
}: MailListPaneProps) {
  const listRef = useListRef(null);
  const { dragRegionClassName, dragRegionProps } = useDesktopChrome();

  // Track the list container height so overscan can be sized as a multiple
  // of the viewport (see OVERSCAN_VIEWPORTS). Falls back to a sensible
  // minimum until the first onResize fires.
  const [containerHeight, setContainerHeight] = useState(0);
  const overscanCount = useMemo(() => {
    if (containerHeight <= 0) return MIN_OVERSCAN_ROWS;
    return Math.max(
      MIN_OVERSCAN_ROWS,
      Math.ceil((containerHeight * OVERSCAN_VIEWPORTS) / MAIL_ROW_HEIGHT),
    );
  }, [containerHeight]);
  const onResize = useCallback(
    (size: { height: number; width: number }) => {
      setContainerHeight(size.height);
    },
    [],
  );

  // Selected index; for threaded inbox the selected message may be any
  // message inside a row's conversation.
  const selectedIndex = useMemo(() => {
    if (!messageId) return -1;
    return items.findIndex((item) => {
      if (folder === "inbox" && item.kind === "inbox") {
        const thread = threadByInboundKey.get(item.message.key);
        if (thread) return thread.inboundKeys.includes(messageId);
      }
      return itemKey(item) === messageId;
    });
  }, [folder, items, messageId, threadByInboundKey]);

  // Keep the keyboard-selected row visible (j/k navigation re-routes, which
  // updates messageId — offscreen rows have no DOM node to scroll to).
  useEffect(() => {
    if (selectedIndex < 0) return;
    try {
      listRef.current?.scrollToRow({ index: selectedIndex, align: "auto" });
    } catch {
      // Row not mounted yet (list still measuring) — ignore.
    }
  }, [listRef, selectedIndex]);

  // Back to the top when the visible dataset changes wholesale.
  const itemCount = items.length;
  useEffect(() => {
    if (itemCount === 0) return;
    try {
      listRef.current?.scrollToRow({ index: 0, behavior: "instant" });
    } catch {
      // Empty/remeasuring list — ignore.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountFilter, folder, listRef, search]);

  // Hide the trailing sentinel once every known item is already in the list
  // (e.g. Sent · 34 with 34 rows loaded). Store-level hasMore can stay true
  // when another enabled domain still has pages even though this view is full.
  const reachedKnownTotal =
    typeof totalCount === "number" && items.length >= totalCount;
  const showSentinel = !reachedKnownTotal && (hasMore || loadingMore);
  // The sentinel/skeleton only makes sense when the list overflows the
  // viewport — it signals "scroll to see more". When the loaded items fit
  // entirely on screen (e.g. a 5-item inbox), there's nothing to scroll to,
  // so showing 8 skeleton placeholders below a short list is just noise.
  // The background load-more (onRowsRendered) still fires to auto-fill the
  // screen if more items exist on the server; we only suppress the visual.
  const listFitsViewport =
    containerHeight > 0
      ? items.length * MAIL_ROW_HEIGHT <= containerHeight
      : items.length <= MIN_OVERSCAN_ROWS;
  const sentinelCount = listFitsViewport
    ? 0
    : loadingMore
      ? PLACEHOLDER_ROWS
      : showSentinel
        ? 1
        : 0;
  const rowCount = items.length + sentinelCount;

  const lastFocusKeyRef = useRef<string | null>(null);
  const lastLoadMoreIndexRef = useRef<number>(-1);
  useEffect(() => {
    // Allow another load-more attempt after a fetch finishes or the list grows.
    if (!loadingMore) {
      lastLoadMoreIndexRef.current = -1;
    }
  }, [loadingMore, items.length]);
  const onRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      // Keep the keyboard focus anchor synced to the topmost visible row
      // so arrow navigation starts from the viewport instead of jumping
      // to item 0 when no URL selection or hover anchor exists. The store
      // ignores visible-top updates while an explicit hover anchor is set.
      // Deduplicate: only write when the top row key actually changes, so
      // we don't fire a MobX action on every intermediate scroll frame.
      if (listItemStateStore && items[visibleRows.startIndex]) {
        const key = itemKey(items[visibleRows.startIndex]!);
        if (key !== lastFocusKeyRef.current) {
          lastFocusKeyRef.current = key;
          listItemStateStore.setFocus(key, "visible-top");
        }
      }
      if (reachedKnownTotal || !hasMore || loadingMore || !onLoadMore) return;
      if (visibleRows.stopIndex >= items.length - LOAD_MORE_THRESHOLD) {
        // Guard against repeated calls: once we've triggered a load for a
        // given stop index, don't fire again until the next page arrives
        // (loadingMore flips to true) or the list grows past this index.
        if (visibleRows.stopIndex === lastLoadMoreIndexRef.current) return;
        lastLoadMoreIndexRef.current = visibleRows.stopIndex;
        onLoadMore();
      }
    },
    [reachedKnownTotal, hasMore, items, loadingMore, onLoadMore, listItemStateStore],
  );

  const rowKey = useCallback(
    (index: number, props: MailRowProps) => props.items[index]?.id ?? `row-${index}`,
    [],
  );

  // Memoize the rowProps object so that parent re-renders (triggered by
  // MailListView observer updates) do not create a new object reference
  // and force react-window to re-render every mounted row.
  const rowPropsMemo = useMemo<MailRowProps>(
    () => ({
      items,
      folder,
      messageId,
      folderBase,
      accountFilter,
      threadByInboundKey,
      isUnread,
      commandRuntimeFor,
      loadingMore,
      hasMore: showSentinel,
      listItemStateStore,
    }),
    [
      items,
      folder,
      messageId,
      folderBase,
      accountFilter,
      threadByInboundKey,
      isUnread,
      commandRuntimeFor,
      loadingMore,
      showSentinel,
      listItemStateStore,
    ],
  );

  const title = FOLDER_TITLES[folder];
  const isSearchHeader = searchTotal != null || searchLoading;
  const countLabel = isSearchHeader
    ? searchLoading
      ? "Searching…"
      : `${(searchTotal ?? 0).toLocaleString()} result${searchTotal === 1 ? "" : "s"}`
    : typeof totalCount === "number"
      ? totalCount.toLocaleString()
      : null;

  return (
    <EmailListContainer plain>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          {...dragRegionProps}
          className={cn(
            "flex shrink-0 select-none items-baseline gap-2 px-4 pb-0 pt-2",
            dragRegionClassName,
          )}
        >
          <h2 className="text-sm font-semibold">{title}</h2>
          {countLabel != null ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {isSearchHeader ? countLabel : `· ${countLabel}`}
              {!isSearchHeader &&
              typeof unreadCount === "number" &&
              unreadCount > 0
                ? ` (${unreadCount.toLocaleString()} unread)`
                : null}
            </span>
          ) : null}
        </div>
        <ListToolbar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search mail…"
          trailing={
            folder === "trash" && items.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => emptyTrash()}>
                Empty trash
              </Button>
            ) : undefined
          }
        />
        {items.length > 0 ? (
          <>
            <EmailTableHeader>
              <span className="flex items-center gap-2">
                <span className="size-7 shrink-0" aria-hidden />
                <span>
                  {folder === "sent" || folder === "drafts"
                    ? "To"
                    : folder === "trash"
                      ? "From / To"
                      : "From"}
                </span>
              </span>
              <span>Subject</span>
              <span>Date</span>
            </EmailTableHeader>
            <List
              listRef={listRef}
              className="min-h-0 flex-1"
              rowComponent={
                MailRow as unknown as (props: RowComponentProps<MailRowProps>) => React.ReactElement | null
              }
              rowCount={rowCount}
              rowHeight={MAIL_ROW_HEIGHT}
              rowKey={rowKey}
              overscanCount={overscanCount}
              onResize={onResize}
              onRowsRendered={onRowsRendered}
              rowProps={rowPropsMemo}
            />
          </>
        ) : searchLoading ? (
          <EmptyListState
            icon={Inbox}
            title="Searching…"
            description="Looking for matching mail on the server."
          />
        ) : (
          <EmptyListState
            icon={
              folder === "sent"
                ? Send
                : folder === "trash"
                  ? Trash2
                  : folder === "drafts"
                    ? FilePen
                    : Inbox
            }
            title={
              folder === "sent"
                ? accountFilter === "all"
                  ? "No sent emails yet"
                  : `No sent mail for ${accountFilter}`
                : folder === "trash"
                  ? accountFilter === "all"
                    ? "Trash is empty"
                    : `No trash for ${accountFilter}`
                  : folder === "drafts"
                    ? accountFilter === "all"
                      ? "No drafts"
                      : `No drafts for ${accountFilter}`
                    : accountFilter === "all"
                      ? "Inbox is empty"
                      : `No mail for ${accountFilter}`
            }
            description={
              folder === "sent"
                ? "Compose an email to start sending from your domain."
                : folder === "trash"
                  ? "Deleted mail from Inbox and Sent appears here. You can restore it."
                  : folder === "drafts"
                    ? "Unsent messages you save will appear here."
                    : "Inbound mail routed to your domain will appear here."
            }
            action={
              folder === "sent" || folder === "drafts" ? (
                <Button
                  size="sm"
                  disabled={!relaybaseOk}
                  render={<Link href={composeNewHref} />}
                >
                  Compose email
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </EmailListContainer>
  );
}
