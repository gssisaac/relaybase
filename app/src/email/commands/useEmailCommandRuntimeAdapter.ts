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
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import type { EmailMailboxSection } from "@/email/components/EmailMailboxLayout";
import type { MailListItem } from "@/email/components/types";
import type { TrashKind } from "@/email/trash-store";

type MailFolder = Extract<EmailMailboxSection, "inbox" | "sent" | "trash">;

function accountQuery(account: EmailAccountFilter) {
  if (account === "all") return "";
  return `?account=${encodeURIComponent(account)}`;
}

function composeHref(compose: string, fromAccount: EmailAccountFilter) {
  if (fromAccount === "all") return compose;
  return `${compose}?from=${encodeURIComponent(fromAccount)}`;
}

function messageHref(
  folderBase: string,
  item: MailListItem,
  account: EmailAccountFilter,
  compose: string,
) {
  if (item.kind === "draft") {
    if (item.message.replyKey) {
      const path = `${folderBase}/${encodeURIComponent(item.message.replyKey)}`;
      return `${path}${accountQuery(account)}`;
    }
    return `${compose}?draft=${encodeURIComponent(item.message.id)}`;
  }
  const id = item.kind === "inbox" ? item.message.key : item.message.id;
  const path = `${folderBase}/${encodeURIComponent(id)}`;
  return `${path}${accountQuery(account)}`;
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
  markRead: (key: string) => void;
  markUnread: (key: string) => void;
  moveToTrash: (kind: TrashKind, id: string) => void;
  restoreFromTrash: (kind: TrashKind, id: string) => void;
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
    compose,
    inbox,
    listHref,
    router,
    isUnread,
    markRead,
    markUnread,
    moveToTrash,
    restoreFromTrash,
  } = input;
  const { setScope, paletteOpen } = useEmailCommandRuntime();

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

  const makeReplyHref = useCallback(
    (id: string, mode: "reply" | "replyAll") => {
      const params = new URLSearchParams();
      if (accountFilter !== "all") {
        params.set("account", accountFilter);
      }
      params.set(mode === "replyAll" ? "replyAll" : "reply", "1");
      return `${inbox}/${encodeURIComponent(id)}?${params.toString()}`;
    },
    [accountFilter, inbox],
  );

  const commandRuntimeFor = useCallback(
    (target: MailListItem | null): EmailCommandRuntime => {
      const targetId =
        target?.kind === "inbox"
          ? target.message.key
          : target?.kind === "sent"
            ? target.message.id
            : null;
      const targetHref = target
        ? messageHref(folderBase, target, accountFilter, compose)
        : undefined;
      const isInboxTarget = target?.kind === "inbox";
      const canReply = Boolean(
        target &&
          target.kind === "inbox" &&
          folder !== "trash" &&
          target.message.key.trim(),
      );
      return {
        folder,
        target,
        targetHref,
        composeHref: composeHref(compose, accountFilter),
        canReply,
        isTargetUnread: isInboxTarget
          ? isUnread(target.message.key)
          : false,
        onNavigate: (href) => router.push(href),
        onReply: (mode) => {
          if (!target || target.kind !== "inbox") return;
          router.push(makeReplyHref(target.message.key, mode));
        },
        onTrashTarget: () => {
          if (!targetId || !target || target.kind === "draft") return;
          moveToTrash(target.kind, targetId);
          router.push(listHref);
        },
        onRestoreTarget: () => {
          if (!targetId || !target || target.kind === "draft") return;
          restoreFromTrash(target.kind, targetId);
          router.push(listHref);
        },
        onMarkReadTarget: () => {
          if (!target || target.kind !== "inbox") return;
          markRead(target.message.key);
        },
        onMarkUnreadTarget: () => {
          if (!target || target.kind !== "inbox") return;
          markUnread(target.message.key);
        },
        onCopyText: copyText,
      };
    },
    [
      accountFilter,
      compose,
      copyText,
      folder,
      folderBase,
      isUnread,
      listHref,
      makeReplyHref,
      markRead,
      markUnread,
      moveToTrash,
      restoreFromTrash,
      router,
    ],
  );

  const selectedCommands = useMemo(
    () => resolveEmailCommands(commandRuntimeFor(selected)),
    [commandRuntimeFor, selected],
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
    folder === "inbox" ? "Inbox" : folder === "sent" ? "Sent" : "Trash";

  useEffect(() => {
    setScope({
      title: scopeTitle,
      targetId: scopeTargetId,
      targetKind: scopeTargetKind,
      commands: selectedCommands,
    });
  }, [
    scopeTitle,
    scopeTargetId,
    scopeTargetKind,
    selectedCommands,
    setScope,
  ]);

  useEffect(() => {
    return () => setScope(null);
  }, [setScope]);

  return {
    commandRuntimeFor,
    selectedCommands,
    runSelectedCommand,
    paletteOpen,
  };
}
