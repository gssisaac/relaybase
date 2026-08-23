"use client";

import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { useEmailCommandRuntime } from "@/email/commands/EmailCommandRuntimeContext";
import {
  resolveEmailCommands,
  runEmailCommand,
  type EmailCommandId,
  type EmailCommandRuntime,
  type ResolvedEmailCommand,
} from "@/email/commands/email-command-store";
import type { EmailAccountFilter } from "@/email/components/accounts/EmailAccountSelect";
import type { EmailMailboxSection } from "@/email/components/mailbox/EmailMailboxLayout";
import type { MailListItem } from "@/email/components/mailbox/types";
import {
  exactDraftComposeHref,
  useStandaloneComposeOpener,
  useThreadComposeOpener,
} from "@/email/lib/compose/compose-open";
import { emailMessageHref } from "@/email/lib/paths";
import type { TrashKind } from "@/email/lib/trash/trash-store";

type MailFolder = Extract<
  EmailMailboxSection,
  "inbox" | "drafts" | "sent" | "trash"
>;

function messageHref(
  folderBase: string,
  item: MailListItem,
  account: EmailAccountFilter,
  inbox: string,
) {
  if (item.kind === "draft") {
    if (item.message.replyKey) {
      return emailMessageHref(inbox, item.message.replyKey, { account });
    }
    if (item.message.forwardKey) {
      return emailMessageHref(inbox, item.message.forwardKey, { account });
    }
    return exactDraftComposeHref(item.message.id, account);
  }
  const id = item.kind === "inbox" ? item.message.key : item.message.id;
  return emailMessageHref(folderBase, id, { account });
}

export type UseEmailCommandRuntimeAdapterInput = {
  folder: MailFolder;
  selected: MailListItem | null;
  accountFilter: EmailAccountFilter;
  folderBase: string;
  compose: string;
  inbox: string;
  listHref: string;
  router: { push: (href: string) => void };
  isUnread: (key: string) => boolean;
  /** When set, inbox mark-read/unread/trash apply to the whole conversation. */
  threadInboundKeysFor: (inboxKey: string) => string[];
  markRead: (key: string) => void;
  markUnread: (key: string) => void;
  markReadMany: (keys: string[]) => void;
  markUnreadMany: (keys: string[]) => void;
  moveToTrash: (kind: TrashKind, id: string) => void;
  moveInboxToTrashMany: (ids: string[]) => void;
  restoreFromTrash: (kind: TrashKind, id: string) => void;
  /** Currently open message (`?m=`). Used to prefer inline reply over URL. */
  messageId?: string;
  /**
   * Same opener as keyboard `r`/`a`/`f` on an open inbox thread.
   * Cmd+K / context menu must use this when the target thread is already open.
   */
  openThreadCompose?: (
    mode: "reply" | "replyAll" | "forward",
    inboundKey: string,
  ) => void;
};

export type UseEmailCommandRuntimeAdapterResult = {
  commandRuntimeFor: (target: MailListItem | null) => EmailCommandRuntime;
  selectedCommands: ResolvedEmailCommand[];
  runSelectedCommand: (id: EmailCommandId) => boolean;
  paletteOpen: boolean;
};

export function useEmailCommandRuntimeAdapter(
  input: UseEmailCommandRuntimeAdapterInput,
): UseEmailCommandRuntimeAdapterResult {
  const {
    folder,
    selected,
    accountFilter,
    folderBase,
    inbox,
    listHref,
    router,
    isUnread,
    threadInboundKeysFor,
    markRead,
    markUnread,
    markReadMany,
    markUnreadMany,
    moveToTrash,
    moveInboxToTrashMany,
    restoreFromTrash,
    messageId,
    openThreadCompose,
  } = input;
  const { setScope, paletteOpen } = useEmailCommandRuntime();
  const {
    openCompose,
    openComposeNew,
    hasResumableDraft,
  } = useStandaloneComposeOpener();
  const { openReply, openForward, openForwardSent } = useThreadComposeOpener();

  const copyText = useCallback(async (text: string, label: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  }, []);

  const commandRuntimeFor = useCallback(
    (target: MailListItem | null): EmailCommandRuntime => {
      const targetId =
        target?.kind === "inbox"
          ? target.message.key
          : target?.kind === "sent"
            ? target.message.id
            : null;
      const targetHref = target
        ? messageHref(folderBase, target, accountFilter, inbox)
        : undefined;
      const isInboxTarget = target?.kind === "inbox";
      const threadKeys =
        isInboxTarget && folder === "inbox"
          ? threadInboundKeysFor(target.message.key)
          : isInboxTarget
            ? [target.message.key]
            : [];
      const canReply = Boolean(
        target &&
          target.kind === "inbox" &&
          folder !== "trash" &&
          target.message.key.trim(),
      );
      const canForward = Boolean(
        target &&
          (target.kind === "inbox" || target.kind === "sent") &&
          (folder === "inbox" || folder === "sent"),
      );
      const isTargetUnread = isInboxTarget
        ? threadKeys.some((key) => isUnread(key))
        : false;
      return {
        folder,
        target,
        targetHref,
        hasResumableComposeDraft: hasResumableDraft,
        canReply,
        canForward,
        isTargetUnread,
        onNavigate: (href) => router.push(href),
        onCompose: openCompose,
        onComposeNew: openComposeNew,
        onReply: (mode) => {
          if (!target || target.kind !== "inbox") return;
          const threadKeys =
            folder === "inbox"
              ? threadInboundKeysFor(target.message.key)
              : [target.message.key];
          const latest = threadKeys.at(-1) ?? target.message.key;
          const threadIsOpen = Boolean(
            messageId && threadKeys.includes(messageId),
          );
          if (threadIsOpen && openThreadCompose) {
            openThreadCompose(mode, latest);
            return;
          }
          openReply(latest, mode);
        },
        onForward: () => {
          if (!target || (target.kind !== "inbox" && target.kind !== "sent")) {
            return;
          }
          if (target.kind === "inbox") {
            const threadKeys =
              folder === "inbox"
                ? threadInboundKeysFor(target.message.key)
                : [target.message.key];
            const latest = threadKeys.at(-1) ?? target.message.key;
            const threadIsOpen = Boolean(
              messageId && threadKeys.includes(messageId),
            );
            if (threadIsOpen && openThreadCompose) {
              openThreadCompose("forward", latest);
              return;
            }
            openForward(latest);
            return;
          }
          openForwardSent(target.message.id);
        },
        onTrashTarget: () => {
          if (!targetId || !target || target.kind === "draft") return;
          if (target.kind === "inbox" && folder === "inbox") {
            moveInboxToTrashMany(threadInboundKeysFor(target.message.key));
          } else {
            moveToTrash(target.kind, targetId);
          }
          router.push(listHref);
        },
        onRestoreTarget: () => {
          if (!targetId || !target || target.kind === "draft") return;
          if (target.kind === "inbox" && threadKeys.length > 1) {
            for (const key of threadKeys) {
              restoreFromTrash("inbox", key);
            }
          } else {
            restoreFromTrash(target.kind, targetId);
          }
          router.push(listHref);
        },
        onMarkReadTarget: () => {
          if (!target || target.kind !== "inbox") return;
          if (folder === "inbox") {
            markReadMany(threadInboundKeysFor(target.message.key));
          } else {
            markRead(target.message.key);
          }
        },
        onMarkUnreadTarget: () => {
          if (!target || target.kind !== "inbox") return;
          if (folder === "inbox") {
            markUnreadMany(threadInboundKeysFor(target.message.key));
          } else {
            markUnread(target.message.key);
          }
        },
        onCopyText: copyText,
      };
    },
    [
      accountFilter,
      copyText,
      folder,
      folderBase,
      hasResumableDraft,
      inbox,
      isUnread,
      listHref,
      markRead,
      markReadMany,
      markUnread,
      markUnreadMany,
      messageId,
      moveInboxToTrashMany,
      moveToTrash,
      openCompose,
      openComposeNew,
      openForward,
      openForwardSent,
      openReply,
      openThreadCompose,
      restoreFromTrash,
      router,
      threadInboundKeysFor,
    ],
  );

  // MailListView rebuilds `selected` every render; key on identity + unread so
  // resolve() does not thrash (and cannot feed a setScope render loop).
  const selectedThreadUnread =
    selected?.kind === "inbox" && folder === "inbox"
      ? threadInboundKeysFor(selected.message.key).some((key) => isUnread(key))
      : selected?.kind === "inbox"
        ? isUnread(selected.message.key)
        : false;
  const selectionKey =
    selected == null
      ? "none"
      : selected.kind === "inbox"
        ? `inbox:${selected.message.key}:${selectedThreadUnread ? "u" : "r"}`
        : `${selected.kind}:${selected.message.id}`;

  const selectedCommands = useMemo(
    () => resolveEmailCommands(commandRuntimeFor(selected)),
    // selectionKey is the stable identity for `selected`.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [commandRuntimeFor, selectionKey, hasResumableDraft],
  );

  const runSelectedCommand = useCallback(
    (id: EmailCommandId) => runEmailCommand(selectedCommands, id),
    [selectedCommands],
  );

  const scopeTargetId =
    selected?.kind === "inbox"
      ? selected.message.key
      : selected?.kind === "sent" || selected?.kind === "draft"
        ? selected.message.id
        : undefined;
  const scopeTargetKind = selected?.kind;
  const scopeTitle =
    folder === "inbox"
      ? "Inbox"
      : folder === "drafts"
        ? "Drafts"
        : folder === "sent"
          ? "Sent"
          : "Trash";

  // Primitive identity for the publish effect — never depend on the commands
  // array reference (MailListView rebuilds `selected` every render).
  const scopeKey = `${scopeTitle}\0${scopeTargetId ?? ""}\0${scopeTargetKind ?? ""}\0${selectionKey}\0${hasResumableDraft ? "1" : "0"}\0${selectedCommands
    .map((command) => `${command.id}:${command.label}`)
    .join(",")}`;

  useEffect(() => {
    setScope({
      title: scopeTitle,
      targetId: scopeTargetId,
      targetKind: scopeTargetKind,
      commands: selectedCommands,
    });
    return () => setScope(null);
    // scopeKey captures selection + command ids; listing selectedCommands would
    // retrigger on every parent render even when content is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [scopeKey, setScope]);

  return {
    commandRuntimeFor,
    selectedCommands,
    runSelectedCommand,
    paletteOpen,
  };
}
