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

export type EmailApiMapResult = string | null | "empty-sent";

/**
 * Map Next `/api/email/*` paths onto Worker admin routes.
 * Returns null when the path is not wired (caller should soft-fail).
 */
export function mapEmailApiToWorker(path: string): EmailApiMapResult {
  const { pathname, search } = splitApiPath(path);
  if (!pathname.startsWith("/api/email")) return null;

  const rest = pathname.slice("/api/email".length) || "/";

  if (rest === "/config" || rest.startsWith("/config/")) {
    return `/admin/mailbox/config${search}`;
  }
  if (rest === "/domains" || rest.startsWith("/domains")) {
    // Onboarding is just POST /admin/domains — no separate onboard pipeline.
    if (rest.startsWith("/domains/onboard")) {
      return `/admin/domains${search}`;
    }
    if (rest.startsWith("/domains/")) return null;
    return `/admin/domains${search}`;
  }
  if (rest === "/addresses" || rest.startsWith("/addresses")) {
    return `/admin/addresses${search}`;
  }
  if (rest === "/send" || rest.startsWith("/send/")) {
    return `/admin/send${search}`;
  }
  if (rest === "/sent" || rest.startsWith("/sent/")) {
    // Sent list comes from send logs; clients that still hit /sent get empty.
    return "empty-sent";
  }
  if (rest === "/inbox/notifications") {
    return `/admin/inbox/notifications${search}`;
  }
  if (rest === "/inbox" || rest.startsWith("/inbox/")) {
    return `/admin/inbox${rest.slice("/inbox".length)}${search}`;
  }
  if (rest === "/keys" || rest.startsWith("/keys/")) {
    return `/admin/keys${rest.slice("/keys".length)}${search}`;
  }
  if (rest === "/audience-groups" || rest.startsWith("/audience-groups")) {
    return `/admin/audience-groups${rest.slice("/audience-groups".length)}${search}`;
  }
  if (rest === "/broadcasts" || rest.startsWith("/broadcasts")) {
    return `/admin/broadcasts${rest.slice("/broadcasts".length)}${search}`;
  }
  if (rest === "/stats" || rest.startsWith("/stats/")) {
    return `/admin/stats${search}`;
  }
  if (rest === "/account-stats" || rest.startsWith("/account-stats")) {
    return `/admin/stats/account-stats${search}`;
  }
  if (rest === "/account-logs" || rest.startsWith("/account-logs")) {
    return `/admin/stats/account-logs${search}`;
  }
  if (rest === "/logs" || rest.startsWith("/logs")) {
    return `/admin/ops-logs${search}`;
  }

  return null;
}

/** @deprecated Use mapEmailApiToWorker */
export const mapPackagedEmailApiToWorker = mapEmailApiToWorker;

export function isEmailApiPath(path: string): boolean {
  return splitApiPath(path).pathname.startsWith("/api/email");
}

export function isAnyApiPath(path: string): boolean {
  return splitApiPath(path).pathname.startsWith("/api/");
}
