"use client";

import { useCallback, useEffect, useMemo } from "react";
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
} from "@/email/components/EmailListShell";
import {
  formatDate,
  itemKey,
  messageHref,
  previewText,
} from "@/email/components/mail-list-helpers";
import type { MailListItem } from "@/email/components/types";
import {
  threadUnreadKeys,
  type ConversationThread,
} from "@/email/conversation-threading";
import { trimQuotedHistoryForThread } from "@/email/reply-quote-body";
import { formatSenderDisplay } from "@/lib/email/format-sender";
import { extractFirstEmail, SenderAvatar } from "@/email/components/SenderAvatar";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

type MailListFolder = "inbox" | "drafts" | "sent" | "trash";

/** EmailTableRow: size-7 avatar (28) + py-2 (16) + bottom border (1). */
const MAIL_ROW_HEIGHT = 45;
/** Start fetching the next page this many rows before the end. */
const LOAD_MORE_THRESHOLD = 10;

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
};

/**
 * Virtualized row. `observer` so per-row observable reads (unread state via
 * `isUnread`) keep reacting even though only visible rows are mounted.
 */
const MailRow = observer(function MailRow({
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
}: RowComponentProps<MailRowProps>) {
  const item = items[index];
  if (!item) {
    // Trailing sentinel row (only rendered while more pages exist).
    return (
      <div
        style={style}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        {loadingMore ? "Loading more…" : "Scroll to load more"}
      </div>
    );
  }

  if (item.kind === "draft") {
    const primary = item.message.to || "(no recipient)";
    const subject = item.message.subject || "(no subject)";
    const date = formatDate(item.message.updatedAt);
    const preview = previewText(item);
    const isSelected = item.message.id === messageId;
    return (
      <div style={style} className="overflow-hidden">
        <EmailCommandContextMenu runtime={commandRuntimeFor(item)}>
          <EmailTableRow
            href={messageHref(folderBase, item, accountFilter)}
            selected={isSelected}
            primary={primary}
            subject={subject}
            preview={preview}
            date={date}
            avatar={
              <SenderAvatar fromEmail={extractFirstEmail(item.message.to)} />
            }
            status={
              item.message.replyKey ? (
                <Badge variant="secondary" className="text-[10px]">
                  Reply
                </Badge>
              ) : item.message.forwardKey ? (
                <Badge variant="secondary" className="text-[10px]">
                  Forward
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Draft
                </Badge>
              )
            }
          />
        </EmailCommandContextMenu>
      </div>
    );
  }

  const isInbox = item.kind === "inbox";
  const thread =
    isInbox && folder === "inbox"
      ? threadByInboundKey.get(item.message.key)
      : null;
  const primary = isInbox
    ? (thread?.participantLabel ??
      formatSenderDisplay(item.message.fromName, item.message.fromEmail))
    : item.message.to;
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
      : false;
  const stackCount =
    thread && thread.messageCount > 1 ? thread.messageCount : undefined;
  return (
    <div style={style} className="overflow-hidden">
      <EmailCommandContextMenu runtime={commandRuntimeFor(item)}>
        <EmailTableRow
          href={messageHref(folderBase, item, accountFilter)}
          selected={isSelected}
          unread={unread}
          avatar={
            isInbox ? (
              <SenderAvatar
                fromName={item.message.fromName}
                fromEmail={item.message.fromEmail}
                unread={unread}
              />
            ) : (
              <SenderAvatar fromEmail={extractFirstEmail(item.message.to)} />
            )
          }
          primary={
            folder === "trash"
              ? `${isInbox ? "In" : "Sent"} · ${primary}`
              : primary
          }
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
});

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
}: MailListPaneProps) {
  const listRef = useListRef(null);
  const { dragRegionClassName, dragRegionProps } = useDesktopChrome();

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

  const showSentinel = hasMore || loadingMore;
  const rowCount = items.length + (showSentinel ? 1 : 0);

  const onRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      if (!hasMore || loadingMore || !onLoadMore) return;
      if (visibleRows.stopIndex >= items.length - LOAD_MORE_THRESHOLD) {
        onLoadMore();
      }
    },
    [hasMore, items.length, loadingMore, onLoadMore],
  );

  const rowKey = useCallback(
    (index: number, props: MailRowProps) => props.items[index]?.id ?? `row-${index}`,
    [],
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
              rowComponent={MailRow}
              rowCount={rowCount}
              rowHeight={MAIL_ROW_HEIGHT}
              rowKey={rowKey}
              overscanCount={8}
              onRowsRendered={onRowsRendered}
              rowProps={{
                items,
                folder,
                messageId,
                folderBase,
                accountFilter,
                threadByInboundKey,
                isUnread,
                commandRuntimeFor,
                loadingMore,
              }}
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
