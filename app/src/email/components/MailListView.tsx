"use client";

import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useEmailCommandRuntimeAdapter } from "@/email/commands";
import type { EmailMailboxSection } from "@/email/components/EmailMailboxLayout";
import { useEmailMailboxStore } from "@/email/components/EmailMailboxContext";
import { MailDetailPane } from "@/email/components/MailDetailPane";
import { MailListPane } from "@/email/components/MailListPane";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import { useMailListItems } from "@/email/components/useMailListItems";
import { useMailListKeyboard } from "@/email/components/useMailListKeyboard";
import { useThreadComposeState } from "@/email/components/useThreadComposeState";
import { useStandaloneComposeOpener } from "@/email/compose-open";
import { EmailListContainer } from "@/email/components/EmailListShell";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { cn } from "@/lib/utils";

type MailListViewProps = {
  folder: Extract<EmailMailboxSection, "inbox" | "drafts" | "sent" | "trash">;
  messageId?: string;
};

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

  const [search, setSearch] = useState("");
  const { openCompose: openStandaloneCompose, openComposeNew, composeNewHref } =
    useStandaloneComposeOpener();

  useEffect(() => {
    setSearch("");
  }, [folder, store.accountFilter]);

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
  } = useMailListItems({
    folder,
    messageId,
    search,
  });

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
