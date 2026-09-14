"use client";

import { usePathname } from "next/navigation";

import {
  useProductApiBase,
  useProductHref,
} from "@/lib/dashboard/shared/ProductContext";
import {
  emailComposeBasePath,
  emailFolderBasePath,
  isShellEmailPath,
  usesShellEmailRoutes,
  type EmailFolder,
} from "./email-route-bases";

export type { EmailFolder };
export { isShellEmailPath };

/** Mail client routes under `/email/*` (desktop + web owner shell) or `/*` (web team). */
export function useEmailPaths() {
  const pathname = usePathname();
  const shellEmail = usesShellEmailRoutes(pathname);
  const apiBase = useProductApiBase("email");
  const base = useProductHref();
  const email = shellEmail ? useProductHref("email") : "/inbox";
  const inbox = shellEmail ? useProductHref("email", "inbox") : "/inbox";
  const drafts = shellEmail ? useProductHref("email", "drafts") : "/drafts";
  const sent = shellEmail ? useProductHref("email", "sent") : "/sent";
  const compose = shellEmail ? useProductHref("email", "compose") : "/compose";
  const trash = shellEmail ? useProductHref("email", "trash") : "/trash";
  const settings = shellEmail
    ? useProductHref("email", "settings")
    : "/mail-settings";

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
    settings,
  };
}

export function emailAccountHref(
  folder: Exclude<EmailFolder, "compose" | "settings">,
  account?: string | null,
) {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const base = emailFolderBasePath(folder, pathname);
  if (!account || account === "all") return base;
  return `${base}?account=${encodeURIComponent(account)}`;
}

export function emailComposeHref(
  from?: string | null,
  options?: {
    draftId?: string | null;
    base?: string;
    /** Skip standalone draft resume (`shift+c` / Compose new). */
    forceNew?: boolean;
    to?: string | null;
    subject?: string | null;
  },
) {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const defaultBase = emailComposeBasePath(pathname);
  const rawBase = options?.base ?? defaultBase;
  const qIndex = rawBase.indexOf("?");
  const path = qIndex >= 0 ? rawBase.slice(0, qIndex) : rawBase;
  const params = new URLSearchParams(
    qIndex >= 0 ? rawBase.slice(qIndex + 1) : "",
  );
  if (from && from !== "all") params.set("from", from);
  const to = options?.to?.trim();
  if (to) params.set("to", to);
  const subject = options?.subject?.trim();
  if (subject) params.set("subject", subject);
  if (options?.forceNew) {
    params.set("new", "1");
    params.delete("draft");
  } else {
    params.delete("new");
    const draftId = options?.draftId?.trim();
    if (draftId) params.set("draft", draftId);
  }
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export function emailFolderHref(
  folder: Exclude<EmailFolder, "compose" | "settings">,
  account?: string | null,
) {
  return emailAccountHref(folder, account);
}

/**
 * Message detail URL for static-export-safe navigation.
 * Packaged Tauri only pre-renders section roots (`/email/inbox`, …), so
 * selection lives in `?m=` rather than a path segment.
 */
export function emailMessageHref(
  folderBase: string,
  messageId: string,
  options?: {
    account?: string | null;
    /** Extra query keys (reply, replyAll, draftId, …). */
    params?: Record<string, string | undefined | null>;
  },
): string {
  const params = new URLSearchParams();
  const account = options?.account?.trim();
  if (account && account !== "all") {
    params.set("account", account);
  }
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value != null && value !== "") params.set(key, value);
    }
  }
  params.set("m", messageId);
  return `${folderBase}?${params.toString()}`;
}

/** Read selected message id from query (`m`) or legacy path segment. */
export function emailMessageIdFromSearch(
  searchParams: { get: (name: string) => string | null },
  pathRest: string[] = [],
): string | undefined {
  const fromQuery = searchParams.get("m")?.trim();
  if (fromQuery) return fromQuery;
  if (pathRest.length > 0) {
    return pathRest.map((segment) => decodeURIComponent(segment)).join("/");
  }
  return undefined;
}
