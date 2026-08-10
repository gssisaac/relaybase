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
 * Map Next `/api/email/*` paths onto Worker console (management) and
 * mail (mail operations) routes. Returns null when the path is not wired
 * (caller should soft-fail).
 */
export function mapEmailApiToWorker(path: string): EmailApiMapResult {
  const { pathname, search } = splitApiPath(path);
  if (!pathname.startsWith("/api/email")) return null;

  const rest = pathname.slice("/api/email".length) || "/";

  if (rest === "/config" || rest.startsWith("/config/")) {
    return `/console/mailbox/config${search}`;
  }
  if (rest === "/mobile-config" || rest.startsWith("/mobile-config/")) {
    return `/console/mobile-config${rest.slice("/mobile-config".length)}${search}`;
  }
  if (rest === "/domains" || rest.startsWith("/domains")) {
    // Onboarding is just POST /console/domains — no separate onboard pipeline.
    if (rest.startsWith("/domains/onboard")) {
      return `/console/domains${search}`;
    }
    if (rest.startsWith("/domains/")) return null;
    return `/console/domains${search}`;
  }
  if (rest === "/addresses" || rest.startsWith("/addresses")) {
    return `/console/addresses${search}`;
  }
  if (rest === "/send" || rest.startsWith("/send/")) {
    return `/mail/send${search}`;
  }
  if (rest === "/sent" || rest.startsWith("/sent/")) {
    // Sent list comes from send logs; clients that still hit /sent get empty.
    return "empty-sent";
  }
  if (rest === "/inbox/notifications") {
    return `/mail/inbox/notifications${search}`;
  }
  if (rest === "/inbox" || rest.startsWith("/inbox/")) {
    return `/mail/inbox${rest.slice("/inbox".length)}${search}`;
  }
  if (rest === "/keys" || rest.startsWith("/keys/")) {
    return `/console/keys${rest.slice("/keys".length)}${search}`;
  }
  if (rest === "/audience-groups" || rest.startsWith("/audience-groups")) {
    return `/console/audience-groups${rest.slice("/audience-groups".length)}${search}`;
  }
  if (rest === "/broadcasts" || rest.startsWith("/broadcasts")) {
    return `/console/broadcasts${rest.slice("/broadcasts".length)}${search}`;
  }
  if (rest === "/stats" || rest.startsWith("/stats/")) {
    return `/console/stats${search}`;
  }
  if (rest === "/account-stats" || rest.startsWith("/account-stats")) {
    return `/console/stats/account-stats${search}`;
  }
  if (rest === "/account-logs" || rest.startsWith("/account-logs")) {
    return `/console/stats/account-logs${search}`;
  }
  if (rest === "/logs" || rest.startsWith("/logs")) {
    return `/console/ops-logs${search}`;
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
