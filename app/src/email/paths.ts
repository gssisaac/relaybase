"use client";

import {
  useProductApiBase,
  useProductHref,
} from "@/lib/dashboard/shared/ProductContext";

export type EmailFolder = "compose" | "inbox" | "drafts" | "sent" | "trash";

/** Mail client routes under `/email/*`. */
export function useEmailPaths() {
  const apiBase = useProductApiBase("email");
  const base = useProductHref();
  const email = useProductHref("email");
  const inbox = useProductHref("email", "inbox");
  const drafts = useProductHref("email", "drafts");
  const sent = useProductHref("email", "sent");
  const compose = useProductHref("email", "compose");
  const trash = useProductHref("email", "trash");

  return {
    apiBase,
    base,
    email,
    emails: email,
    inbox,
    drafts,
    sent,
    compose,
    trash,
  };
}

export function emailAccountHref(
  folder: Exclude<EmailFolder, "compose">,
  account?: string | null,
) {
  const base =
    folder === "inbox"
      ? "/email/inbox"
      : folder === "drafts"
        ? "/email/drafts"
        : folder === "sent"
          ? "/email/sent"
          : "/email/trash";
  if (!account || account === "all") return base;
  return `${base}?account=${encodeURIComponent(account)}`;
}

export function emailComposeHref(from?: string | null) {
  if (!from || from === "all") return "/email/compose";
  return `/email/compose?from=${encodeURIComponent(from)}`;
}

export function emailFolderHref(
  folder: EmailFolder,
  account?: string | null,
) {
  if (folder === "compose") return emailComposeHref(account);
  return emailAccountHref(folder, account);
}
