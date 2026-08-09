import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Eye,
  EyeOff,
  Forward,
  MailOpen,
  Pencil,
  Reply,
  ReplyAll,
  RotateCcw,
  Trash2,
} from "lucide-react";

export type EmailCommandId =
  | "open"
  | "compose"
  | "reply"
  | "replyAll"
  | "forward"
  | "trashOrRestore"
  | "markRead"
  | "markUnread"
  | "copySender"
  | "copySubject";

export type EmailCommandGroup = "navigation" | "actions" | "copy";

export type EmailCommandFolder = "inbox" | "drafts" | "sent" | "trash";

export type EmailCommandTargetKind = "any" | "inbox" | "sent" | "draft";

/**
 * Declarative availability constraints evaluated against the current
 * folder + selected mail item. Commands that fail these are omitted
 * from Cmd+K and context menus (not shown as disabled).
 */
export type EmailCommandRequires = {
  /** Required selection kind. `"any"` means any selected item. */
  target?: EmailCommandTargetKind;
  /** Allowed mailbox folders. Omit = all folders. */
  folders?: EmailCommandFolder[];
  /** Inbox unread state: true = unread only, false = read only. */
  unread?: boolean;
};

/**
 * Static metadata for email commands.
 * Icons, shortcuts, labels, and keywords live here — not in the runtime store.
 */
export type EmailCommandDef = {
  id: EmailCommandId;
  label: string;
  group: EmailCommandGroup;
  keywords: string[];
  icon: LucideIcon;
  /** Keyboard shortcut hint shown in menus / Cmd+K (e.g. "R", "⌘K"). */
  shortcut?: string;
  requires?: EmailCommandRequires;
  /** When folder is trash, trashOrRestore uses these instead. */
  trashLabel?: string;
  trashIcon?: LucideIcon;
};

export const EMAIL_COMMAND_DEFS: readonly EmailCommandDef[] = [
  {
    id: "open",
    label: "Open message",
    group: "navigation",
    keywords: ["open", "message", "view", "detail"],
    icon: MailOpen,
    shortcut: "Enter",
    requires: { target: "any" },
  },
  {
    id: "compose",
    label: "Compose email",
    group: "navigation",
    keywords: ["compose", "new", "mail", "create"],
    icon: Pencil,
    shortcut: "C",
  },
  {
    id: "reply",
    label: "Reply",
    group: "actions",
    keywords: ["reply", "respond"],
    icon: Reply,
    shortcut: "R",
    requires: { target: "inbox", folders: ["inbox"] },
  },
  {
    id: "replyAll",
    label: "Reply all",
    group: "actions",
    keywords: ["reply", "all", "respond", "cc"],
    icon: ReplyAll,
    shortcut: "A",
    requires: { target: "inbox", folders: ["inbox"] },
  },
  {
    id: "forward",
    label: "Forward",
    group: "actions",
    keywords: ["forward", "fwd", "share"],
    icon: Forward,
    shortcut: "F",
    requires: { target: "any", folders: ["inbox", "sent"] },
  },
  {
    id: "trashOrRestore",
    label: "Move to trash",
    group: "actions",
    keywords: ["trash", "delete", "restore"],
    icon: Trash2,
    shortcut: "E",
    requires: { target: "any" },
    trashLabel: "Restore from trash",
    trashIcon: RotateCcw,
  },
  {
    id: "markRead",
    label: "Mark as read",
    group: "actions",
    keywords: ["read", "seen"],
    icon: Eye,
    requires: { target: "inbox", folders: ["inbox"], unread: true },
  },
  {
    id: "markUnread",
    label: "Mark as unread",
    group: "actions",
    keywords: ["unread", "new", "unseen"],
    icon: EyeOff,
    requires: { target: "inbox", folders: ["inbox"], unread: false },
  },
  {
    id: "copySender",
    label: "Copy sender",
    group: "copy",
    keywords: ["copy", "sender", "from", "address"],
    icon: Copy,
    requires: { target: "any" },
  },
  {
    id: "copySubject",
    label: "Copy subject",
    group: "copy",
    keywords: ["copy", "subject", "title"],
    icon: Copy,
    requires: { target: "any" },
  },
] as const;

export function getEmailCommandDef(
  id: EmailCommandId,
): EmailCommandDef | undefined {
  return EMAIL_COMMAND_DEFS.find((command) => command.id === id);
}
