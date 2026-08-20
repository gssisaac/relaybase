"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { EmailCommandId } from "@/email/commands";
import type { EmailMailboxSection } from "@/email/components/mailbox/EmailMailboxLayout";
import { useEmailMailboxStore } from "@/email/components/mailbox/EmailMailboxContext";
import {
  itemKey,
  messageHref,
} from "@/email/components/mailbox/mail-list-helpers";
import type { ListItemStateStore } from "@/email/components/mailbox/list-item-state-store";
import type { MailListItem } from "@/email/components/mailbox/types";
import type { ThreadComposeMode } from "@/email/components/thread/ConversationThreadView";
import type { ConversationThread } from "@/email/lib/threading/conversation-threading";

type MailListFolder = Extract<
  EmailMailboxSection,
  "inbox" | "drafts" | "sent" | "trash"
>;

export function useMailListKeyboard({
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
  moveToTrash,
  restoreFromTrash,
}: {
  folder: MailListFolder;
  messageId?: string;
  items: MailListItem[];
  folderBase: string;
  accountFilter: string;
  listHref: string;
  selected: MailListItem | null;
  selectedThread: ConversationThread | null;
  composeMode: ThreadComposeMode;
  closeCompose: () => void;
  openComposeFromKeyboard: (
    mode: Exclude<ThreadComposeMode, null>,
    inboundKey: string,
  ) => void;
  openStandaloneCompose: () => void;
  openComposeNew: () => void;
  runSelectedCommand: (id: EmailCommandId) => boolean;
  paletteOpen: boolean;
  threadByInboundKey: Map<string, ConversationThread>;
  threadInboundKeysFor: (key: string) => string[];
  listItemStateStore: ListItemStateStore;
  moveToTrash: (kind: "inbox" | "sent", id: string) => void;
  restoreFromTrash: (kind: "inbox" | "sent", id: string) => void;
}) {
  const router = useRouter();
  const store = useEmailMailboxStore();

  useEffect(() => {
    // Mail keyboard layer (bubble): never compete with app-layer ⌘K / palette.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (paletteOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Resolve the keyboard navigation anchor. URL selection takes precedence;
      // otherwise use the hover/visible-top focus managed by ListItemStateStore;
      // finally fall back to the first item so arrows never jump out of the list.
      const anchorKey =
        messageId ??
        listItemStateStore.focusKey ??
        (items.length > 0 ? itemKey(items[0]!) : undefined);

      const currentIndex = items.findIndex((item) => {
        if (
          folder === "inbox" &&
          item.kind === "inbox" &&
          anchorKey
        ) {
          const thread = threadByInboundKey.get(item.message.key);
          if (thread) return thread.inboundKeys.includes(anchorKey);
        }
        return itemKey(item) === anchorKey;
      });

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(messageHref(folderBase, nextItem, accountFilter));
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          const prevItem = items[prevIndex];
          router.push(messageHref(folderBase, prevItem, accountFilter));
        }
      } else if (e.key === "Escape" || e.key === "u") {
        e.preventDefault();
        if (composeMode) {
          closeCompose();
          return;
        }
        router.push(listHref);
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (e.shiftKey) {
          openComposeNew();
        } else {
          openStandaloneCompose();
        }
      } else if (e.key === "r") {
        e.preventDefault();
        if (folder === "inbox" && selectedThread) {
          openComposeFromKeyboard(
            "reply",
            selectedThread.latestInboundKey,
          );
          return;
        }
        runSelectedCommand("reply");
      } else if (e.key === "a") {
        e.preventDefault();
        if (folder === "inbox" && selectedThread) {
          openComposeFromKeyboard(
            "replyAll",
            selectedThread.latestInboundKey,
          );
          return;
        }
        runSelectedCommand("replyAll");
      } else if (e.key === "f") {
        e.preventDefault();
        if (folder === "inbox" && selectedThread) {
          openComposeFromKeyboard(
            "forward",
            selectedThread.latestInboundKey,
          );
          return;
        }
        runSelectedCommand("forward");
      } else if (
        (e.key === "Backspace" || e.key === "Delete" || e.key === "e") &&
        selected &&
        selected.kind !== "draft"
      ) {
        e.preventDefault();
        const kind = selected.kind;
        const id =
          selected.kind === "inbox"
            ? selected.message.key
            : selected.message.id;
        if (folder === "trash") {
          restoreFromTrash(kind, id);
        } else if (kind === "inbox" && folder === "inbox") {
          store.moveInboxToTrashMany(threadInboundKeysFor(id));
        } else {
          moveToTrash(kind, id);
        }

        const nextIndex =
          currentIndex + 1 < items.length
            ? currentIndex + 1
            : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(messageHref(folderBase, nextItem, accountFilter));
        } else {
          router.push(listHref);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    items,
    messageId,
    router,
    folderBase,
    accountFilter,
    selected,
    folder,
    moveToTrash,
    restoreFromTrash,
    listHref,
    composeMode,
    closeCompose,
    openComposeFromKeyboard,
    openComposeNew,
    openStandaloneCompose,
    selectedThread,
    runSelectedCommand,
    paletteOpen,
    store,
    threadByInboundKey,
    threadInboundKeysFor,
    listItemStateStore,
  ]);
}
