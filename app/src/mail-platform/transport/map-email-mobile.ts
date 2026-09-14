/**
 * Map UI-relative `/api/email/*` paths onto Worker `/mobile/*` routes.
 *
 * Email mode (web-only / desktop-without-console) talks to the Worker's
 * mobile surface — the same one the Flutter companion uses. The Worker
 * scopes every `/mobile/*` call to the authenticated account email.
 *
 * Reference: `docs/features/mobile-companion.md`, `worker/src/app.ts`.
 *
 * Returns `null` when the path is not a mail path (caller falls back to
 * a plain fetch, or soft-fails).
 */
export type EmailModeMapResult = string | null | "empty-sent";

function splitApiPath(path: string): { pathname: string; search: string } {
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      return { pathname: u.pathname, search: u.search };
    } catch {
      return { pathname: path, search: "" };
    }
  }
  const local = path.startsWith("/") ? path : `/${path}`;
  const q = local.indexOf("?");
  if (q < 0) return { pathname: local, search: "" };
  return { pathname: local.slice(0, q), search: local.slice(q) };
}

/**
 * Map `/api/email/*` → `/mobile/*` for email (web) mode.
 *
 * Only mail-reading/sending routes are mapped. Console-only routes
 * (`/config`, `/zones`, `/keys`, `/audience-groups`, `/broadcasts`,
 * `/stats`, `/logs`, `/settings`, `/mobile-password`) return `null`
 * — they are not available in email mode and the caller should soft-fail.
 */
export function mapEmailApiToMobile(path: string): EmailModeMapResult {
  const { pathname, search } = splitApiPath(path);
  if (!pathname.startsWith("/api/email")) return null;

  const rest = pathname.slice("/api/email".length) || "/";

  // Notifications → /mobile/notifications
  if (rest === "/inbox/notifications" || rest.startsWith("/inbox/notifications/")) {
    const sub = rest.slice("/inbox/notifications".length);
    return `/mobile/notifications${sub}${search}`;
  }

  // Mail operations → /mobile/*
  if (rest === "/inbox" || rest.startsWith("/inbox/")) {
    return `/mobile/inbox${rest.slice("/inbox".length)}${search}`;
  }
  if (rest === "/sent" || rest.startsWith("/sent/")) {
    return `/mobile/sent${rest.slice("/sent".length)}${search}`;
  }
  if (rest === "/send" || rest.startsWith("/send/")) {
    return `/mobile/send${search}`;
  }
  if (rest === "/favicon" || rest.startsWith("/favicon/")) {
    return `/mobile/favicon${rest.slice("/favicon".length)}${search}`;
  }
  if (rest === "/sending-health" || rest.startsWith("/sending-health/")) {
    return `/mobile/sending-health${search}`;
  }
  if (rest === "/profile" || rest.startsWith("/profile/")) {
    return `/mobile/profile${rest.slice("/profile".length)}${search}`;
  }
  if (rest === "/config" || rest.startsWith("/config/")) {
    return `/mobile/config${search}`;
  }
  // Addresses: in email mode the authenticated account is the only one.
  if (rest === "/addresses") {
    return `/mobile/mailbox${search}`;
  }
  if (rest === "/account-state" || rest.startsWith("/account-state/")) {
    return `/mobile/account-state${rest.slice("/account-state".length)}${search}`;
  }

  // Console-only routes — not wired in email mode.
  // (/config, /zones, /keys, /audience-groups, /broadcasts, /stats,
  //  /logs, /settings, /mobile-password, /domains*, /broadcast-drafts —
  //  broadcast composing is owner/console-only, see console/broadcast-drafts)
  return null;
}

export function isEmailApiPath(path: string): boolean {
  return splitApiPath(path).pathname.startsWith("/api/email");
}
