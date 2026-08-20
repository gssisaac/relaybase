"use client";

import type { LucideIcon } from "lucide-react";

import type { EmailMailboxSection } from "@/email/components/mailbox/EmailMailboxLayout";
import type { MailListItem } from "@/email/components/mailbox/types";
import {
  EMAIL_COMMAND_DEFS,
  type EmailCommandDef,
  type EmailCommandGroup,
  type EmailCommandId,
} from "@/email/commands/email-command-defs";

export type {
  EmailCommandDef,
  EmailCommandGroup,
  EmailCommandId,
} from "@/email/commands/email-command-defs";

export type EmailCommandDescriptor = {
  id: EmailCommandId;
  label: string;
  group: EmailCommandGroup;
  keywords: string[];
  icon: LucideIcon;
  shortcut?: string;
};

export type EmailCommandRuntime = {
  folder: Extract<EmailMailboxSection, "inbox" | "drafts" | "sent" | "trash">;
  target: MailListItem | null;
  targetHref?: string;
  /** True when a standalone draft exists for `c` / Continue draft. */
  hasResumableComposeDraft: boolean;
  canReply: boolean;
  canForward: boolean;
  isTargetUnread: boolean;
  onNavigate: (href: string) => void;
  onCompose: () => void;
  onComposeNew: () => void;
  onReply: (mode: "reply" | "replyAll") => void;
  onForward: () => void;
  onTrashTarget: () => void;
  onRestoreTarget: () => void;
  onMarkReadTarget: () => void;
  onMarkUnreadTarget: () => void;
  onCopyText: (text: string, label: string) => Promise<void> | void;
};

export type ResolvedEmailCommand = EmailCommandDescriptor & {
  run: () => Promise<void> | void;
};

function toDescriptor(
  def: EmailCommandDef,
  runtime: EmailCommandRuntime,
): EmailCommandDescriptor {
  if (def.id === "trashOrRestore" && runtime.folder === "trash") {
    return {
      id: def.id,
      label: def.trashLabel ?? def.label,
      group: def.group,
      keywords: def.keywords,
      icon: def.trashIcon ?? def.icon,
      shortcut: def.shortcut,
    };
  }
  if (def.id === "compose") {
    return {
      id: def.id,
      label: runtime.hasResumableComposeDraft
        ? "Continue draft"
        : "Compose email",
      group: def.group,
      keywords: def.keywords,
      icon: def.icon,
      shortcut: "C",
    };
  }
  if (def.id === "composeNew") {
    return {
      id: def.id,
      label: def.label,
      group: def.group,
      keywords: def.keywords,
      icon: def.icon,
      // When no draft to continue, `c` already opens new — keep ⇧C as the
      // explicit force-new shortcut whenever the command is listed.
      shortcut: "⇧C",
    };
  }
  return {
    id: def.id,
    label: def.label,
    group: def.group,
    keywords: def.keywords,
    icon: def.icon,
    shortcut: def.shortcut,
  };
}

function senderOf(target: MailListItem | null): string {
  if (!target) return "";
  if (target.kind === "inbox") return target.message.fromEmail;
  if (target.kind === "sent") return target.message.from;
  return target.message.from;
}

function subjectOf(target: MailListItem | null): string {
  if (!target) return "";
  return target.message.subject?.trim() || "";
}

function isDraftTarget(target: MailListItem | null): boolean {
  return target?.kind === "draft";
}

function matchesRequires(
  def: EmailCommandDef,
  runtime: EmailCommandRuntime,
): boolean {
  const requires = def.requires;
  if (!requires) return true;

  if (requires.folders && !requires.folders.includes(runtime.folder)) {
    return false;
  }

  if (requires.target) {
    if (!runtime.target) return false;
    if (requires.target !== "any" && runtime.target.kind !== requires.target) {
      return false;
    }
  }

  if (requires.unread !== undefined) {
    if (runtime.target?.kind !== "inbox") return false;
    if (runtime.isTargetUnread !== requires.unread) return false;
  }

  return true;
}

function isRuntimeAvailable(
  id: EmailCommandId,
  runtime: EmailCommandRuntime,
): boolean {
  switch (id) {
    case "open":
      return Boolean(runtime.targetHref);
    case "compose":
      return true;
    case "composeNew":
      // Only offer force-new when there is a draft to leave behind; otherwise
      // `compose` (`c`) already opens a blank message.
      return runtime.hasResumableComposeDraft;
    case "reply":
    case "replyAll":
      return runtime.canReply;
    case "forward":
      return runtime.canForward;
    case "trashOrRestore":
      return Boolean(runtime.target) && !isDraftTarget(runtime.target);
    case "markRead":
      return runtime.target?.kind === "inbox" && runtime.isTargetUnread;
    case "markUnread":
      return runtime.target?.kind === "inbox" && !runtime.isTargetUnread;
    case "copySender":
      return senderOf(runtime.target).trim().length > 0;
    case "copySubject":
      return subjectOf(runtime.target).trim().length > 0;
    default:
      return false;
  }
}

function buildRunner(
  id: EmailCommandId,
  runtime: EmailCommandRuntime,
): () => Promise<void> | void {
  switch (id) {
    case "open":
      return () => {
        if (!runtime.targetHref) return;
        runtime.onNavigate(runtime.targetHref);
      };
    case "compose":
      return () => runtime.onCompose();
    case "composeNew":
      return () => runtime.onComposeNew();
    case "reply":
      return () => runtime.onReply("reply");
    case "replyAll":
      return () => runtime.onReply("replyAll");
    case "forward":
      return () => runtime.onForward();
    case "trashOrRestore":
      return () => {
        if (runtime.folder === "trash") {
          runtime.onRestoreTarget();
          return;
        }
        runtime.onTrashTarget();
      };
    case "markRead":
      return () => runtime.onMarkReadTarget();
    case "markUnread":
      return () => runtime.onMarkUnreadTarget();
    case "copySender":
      return () => runtime.onCopyText(senderOf(runtime.target), "Sender");
    case "copySubject":
      return () => runtime.onCopyText(subjectOf(runtime.target), "Subject");
    default:
      return () => {};
  }
}

/** Available commands only — unavailable defs are omitted, not disabled. */
export function resolveEmailCommands(
  runtime: EmailCommandRuntime,
): ResolvedEmailCommand[] {
  return EMAIL_COMMAND_DEFS.filter(
    (def) => matchesRequires(def, runtime) && isRuntimeAvailable(def.id, runtime),
  ).map((def) => {
    const command = toDescriptor(def, runtime);
    return {
      ...command,
      run: buildRunner(command.id, runtime),
    };
  });
}

export function runEmailCommand(
  commands: ResolvedEmailCommand[],
  id: EmailCommandId,
): boolean {
  const command = commands.find((item) => item.id === id);
  if (!command) return false;
  void command.run();
  return true;
}
