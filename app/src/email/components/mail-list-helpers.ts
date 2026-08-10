"use client";

import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import type { MailListItem } from "@/email/components/types";
import { inboundMatchesAccount } from "@/email/conversation-threading";
import { buildReplyPrefill } from "@/email/reply-helpers";
import { emailMessageHref } from "@/email/paths";

export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Stable formatting (no locale / "today" checks) to avoid SSR hydration mismatches. */
export function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${months[date.getMonth()]} ${date.getDate()}, ${hour12}:${minutes} ${ampm}`;
}

export function formatDetailDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hour12}:${minutes} ${ampm}`;
}

export function accountQuery(account: EmailAccountFilter) {
  if (account === "all") return "";
  return `?account=${encodeURIComponent(account)}`;
}

export function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

export function itemSortAt(item: MailListItem) {
  if (item.kind === "inbox") return item.message.receivedAt;
  if (item.kind === "sent") return item.message.sentAt;
  // Drafts: sort by first creation so autosave doesn't reshuffle the list.
  return item.message.createdAt;
}

export function itemKey(item: MailListItem) {
  if (item.kind === "inbox") return item.message.key;
  return item.message.id;
}

export function matchesAccount(
  item: MailListItem,
  account: EmailAccountFilter,
): boolean {
  if (account === "all") return true;
  const needle = account.toLowerCase();
  if (item.kind === "inbox") {
    return inboundMatchesAccount(item.message, needle);
  }
  if (item.kind === "draft") {
    return !item.message.from || item.message.from.toLowerCase() === needle;
  }
  return item.message.from.toLowerCase() === needle;
}

export function messageHref(
  folderBase: string,
  item: MailListItem,
  account: EmailAccountFilter,
) {
  if (item.kind === "draft") {
    return emailMessageHref(folderBase, item.message.id, { account });
  }
  const id = item.kind === "inbox" ? item.message.key : item.message.id;
  return emailMessageHref(folderBase, id, { account });
}

export function threadingFromParent(
  event: Parameters<typeof buildReplyPrefill>[0] | null | undefined,
) {
  if (!event) return undefined;
  const prefill = buildReplyPrefill(event, [], { replyAll: false });
  return {
    inReplyTo: prefill.inReplyTo,
    references: prefill.references,
  };
}

export function previewText(item: MailListItem) {
  if (item.kind === "inbox") {
    return (
      item.message.bodyPreview?.replace(/\s+/g, " ").trim() ||
      item.message.bodyText?.replace(/\s+/g, " ").trim() ||
      ""
    );
  }
  if (item.kind === "draft") {
    return item.message.body.replace(/\s+/g, " ").trim();
  }
  return item.message.bodyPreview?.replace(/\s+/g, " ").trim() || "";
}
