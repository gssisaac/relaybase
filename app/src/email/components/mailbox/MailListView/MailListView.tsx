"use client";

import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MIN_SERVER_SEARCH_LENGTH } from "@/email/stores/email-mailbox-store";

import { useEmailCommandRuntimeAdapter } from "@/email/commands";
import type { EmailMailboxSection } from "@/email/components/mailbox/EmailMailboxLayout";
import { useEmailMailboxStore } from "@/email/components/mailbox/EmailMailboxContext";
import { MailDetailPane } from "./MailDetailPane";
import { MailListPane } from "./MailListPane";
import { useMailboxNav } from "@/email/components/mailbox/MailboxNavContext";
import { useMailListItems } from "./useMailListItems";
import { useMailListKeyboard } from "./useMailListKeyboard";
import { useThreadComposeState } from "@/email/components/reply/useThreadComposeState";
import { useStandaloneComposeOpener } from "@/email/lib/compose/compose-open";
import { EmailListContainer } from "@/email/components/mailbox/EmailListShell";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { cn } from "@/lib/utils";
import { ListItemStateStore } from "@/email/stores/list-item-state-store";

type MailListViewProps = {
  folder: Extract<EmailMailboxSection, "inbox" | "drafts" | "sent" | "trash">;
  messageId?: string;
};

type MailListFolder = Extract<
  EmailMailboxSection,
  "inbox" | "drafts" | "sent" | "trash"
>;

const FOLDER_KEYS: readonly MailListFolder[] = ["inbox", "drafts", "sent", "trash"];

export const MailListView = observer(function MailListView({
  folder,
  messageId,
}: MailListViewProps) {
  const productId = useProductId();
  const store = useEmailMailboxStore();
  const { compose, inbox, drafts: draftsNav, sent, trash } = useMailboxNav();
  const folderBase =
    folder === "inbox"
      ? inbox
      : folder === "drafts"
        ? draftsNav
        : folder === "sent"
          ? sent
          : trash;
  const router = useRouter();

  // One independent ListItemStateStore per folder so each retains its own
  // keyboard focus anchor across folder switches.
  const [listItemStores] = useState(() => {
    const map = {} as Record<MailListFolder, ListItemStateStore>;
    for (const key of FOLDER_KEYS) map[key] = new ListItemStateStore();
    return map;
  });
  const listItemStateStore = listItemStores[folder];

  const [search, setSearch] = useState("");
  const { openCompose: openStandaloneCompose, openComposeNew, composeNewHref } =
    useStandaloneComposeOpener();

  useEffect(() => {
    setSearch("");
    store.clearSearch();
    listItemStateStore.clearFocus();
  }, [folder, listItemStateStore, store, store.accountFilter]);

  // Clear the keyboard focus anchor when the search text changes, because
  // the filtered list may no longer contain the previously focused item.
  useEffect(() => {
    listItemStateStore.clearFocus();
  }, [listItemStateStore, search]);

  // Debounced server-side search for inbox/sent. Short queries (or other
  // folders) clear server results and fall back to local filtering.
  useEffect(() => {
    const q = search.trim();
    if (
      (folder !== "inbox" && folder !== "sent") ||
      q.length < MIN_SERVER_SEARCH_LENGTH
    ) {
      store.clearSearch();
      return;
    }
    const timer = setTimeout(() => {
      void store.searchMail(folder, q);
    }, 250);
    return () => clearTimeout(timer);
  }, [folder, search, store]);

  const {
    accountFilter,
    listHref,
    items,
    threadByInboundKey,
    threadInboundKeysFor,
    selected,
    selectedThread,
    activityDetail,
    detailLoading,
    serverSearch,
    searchTotal,
    searchLoading,
    hasMore,
    loadingMore,
    loadMore,
  } = useMailListItems({
    folder,
    messageId,
    search,
  });

  // Whole-mailbox counts for the list header. Account-filtered inbox counts
  // come from the per-address `/inbox/counts` aggregate; drafts/trash are
  // fully local so their loaded length is exact.
  const accountCounts =
    accountFilter !== "all" ? store.inboxCountsForAccount(accountFilter) : null;
  const totalCount =
    folder === "inbox"
      ? accountFilter === "all"
        ? store.inboxTotal
        : accountCounts?.total ?? null
      : folder === "sent"
        ? accountFilter === "all"
          ? store.sentTotal
          : null
        : items.length;
  const unreadCount =
    folder === "inbox"
      ? accountFilter === "all"
        ? store.inboxUnreadTotal
        : accountCounts?.unread ?? null
      : null;

  const {
    composeMode,
    composeSourceId,
    setComposeSourceId,
    composeDraftId,
    setComposeDraftId,
    closeCompose,
    openCompose,
    openComposeFromKeyboard,
    onComposeModeChange,
  } = useThreadComposeState({
    folder,
    messageId,
    threadId: selectedThread?.threadId,
    inbox,
  });

  const { commandRuntimeFor, runSelectedCommand, paletteOpen } =
    useEmailCommandRuntimeAdapter({
      folder,
      selected,
      accountFilter,
      folderBase,
      compose,
      inbox,
      listHref,
      router,
      isUnread: store.isUnread,
      threadInboundKeysFor,
      markRead: store.markRead,
      markUnread: store.markUnread,
      markReadMany: store.markReadMany,
      markUnreadMany: store.markUnreadMany,
      moveToTrash: store.moveToTrash,
      moveInboxToTrashMany: store.moveInboxToTrashMany,
      restoreFromTrash: store.restoreFromTrash,
    });

  useMailListKeyboard({
    folder,
    messageId,
    items,
    folderBase,
    accountFilter,
    listHref,
    selected,
    selectedThread,
    composeMode,
    closeCompose,
    openComposeFromKeyboard,
    openStandaloneCompose,
    openComposeNew,
    runSelectedCommand,
    paletteOpen,
    threadByInboundKey,
    threadInboundKeysFor,
    listItemStateStore,
    moveToTrash: store.moveToTrash,
    restoreFromTrash: store.restoreFromTrash,
  });

  const onDraftDiscard = useCallback(() => {
    router.push(listHref);
  }, [listHref, router]);

  const onDraftSend = useCallback(
    ({ from }: { from: string }) => {
      const sentParams = new URLSearchParams({ sent: "1" });
      sentParams.set("account", from);
      router.push(`${sent}?${sentParams.toString()}`);
    },
    [router, sent],
  );

  return (
    <EmailListContainer plain>
      <div className="flex h-full w-full min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden",
            messageId
              ? "hidden shrink-0 border-r border-border/30 md:flex md:w-[360px] lg:w-[400px]"
              : "flex flex-1",
          )}
        >
          <MailListPane
            folder={folder}
            items={items}
            messageId={messageId}
            search={search}
            onSearchChange={setSearch}
            folderBase={folderBase}
            accountFilter={accountFilter}
            threadByInboundKey={threadByInboundKey}
            composeNewHref={composeNewHref}
            relaybaseOk={store.relaybaseOk}
            emptyTrash={store.emptyTrash}
            isUnread={store.isUnread}
            commandRuntimeFor={commandRuntimeFor}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            totalCount={totalCount}
            unreadCount={unreadCount}
            searchTotal={serverSearch ? searchTotal : null}
            searchLoading={serverSearch ? searchLoading : false}
            listItemStateStore={listItemStateStore}
          />
        </div>

        {messageId ? (
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-card/40">
            <MailDetailPane
              folder={folder}
              selected={selected}
              selectedThread={selectedThread}
              messageId={messageId}
              activityDetail={activityDetail}
              detailLoading={detailLoading}
              addresses={store.visibleAddresses}
              accountFilter={accountFilter}
              listHref={listHref}
              inbox={inbox}
              sent={sent}
              productId={productId}
              store={store}
              composeMode={composeMode}
              composeSourceId={composeSourceId}
              setComposeSourceId={setComposeSourceId}
              composeDraftId={composeDraftId}
              setComposeDraftId={setComposeDraftId}
              onComposeModeChange={onComposeModeChange}
              closeCompose={closeCompose}
              openCompose={openCompose}
              threadInboundKeysFor={threadInboundKeysFor}
              moveToTrash={store.moveToTrash}
              restoreFromTrash={store.restoreFromTrash}
              onDraftDiscard={onDraftDiscard}
              onDraftSend={onDraftSend}
              router={router}
            />
          </div>
        ) : null}
      </div>
    </EmailListContainer>
  );
});
