export type SidebarMode = "email" | "dashboard" | "crm";

export const DEFAULT_EMAIL_PATH = "/email/inbox";
export const DEFAULT_DASHBOARD_PATH = "/dashboard";
export const DEFAULT_CRM_PATH = "/crm/contacts";

const BLOCKED_PATH_PREFIXES = ["/login", "/register", "/setup", "/api"] as const;

function isEmailPathname(pathname: string): boolean {
  return (
    pathname === "/email" ||
    pathname.startsWith("/email/") ||
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/") ||
    pathname === "/compose" ||
    pathname.startsWith("/compose/") ||
    pathname === "/drafts" ||
    pathname.startsWith("/drafts/") ||
    pathname === "/sent" ||
    pathname.startsWith("/sent/") ||
    pathname === "/trash" ||
    pathname.startsWith("/trash/") ||
    pathname === "/mail-settings" ||
    pathname.startsWith("/mail-settings/")
  );
}

function isCrmPathname(pathname: string): boolean {
  return pathname === "/crm" || pathname.startsWith("/crm/");
}

export function modeFromPathname(pathname: string): SidebarMode {
  if (isEmailPathname(pathname)) return "email";
  if (isCrmPathname(pathname)) return "crm";
  return "dashboard";
}

function pathnameOnly(path: string): string {
  const noHash = path.split("#")[0] ?? path;
  return noHash.split("?")[0] || "/";
}

/**
 * Packaged static export only has section roots. Rewrite deep path segments
 * into query selection (`?m=`, `?email=` / `?tab=`) so restore / mode-switch
 * never targets missing HTML.
 */
export function normalizeEntryPath(path: string): string {
  const [pathnamePart, query = ""] = path.split("?");
  const pathname = pathnamePart || "/";
  const params = new URLSearchParams(query);

  const emailSection = pathname.match(
    /^\/email\/(inbox|drafts|sent|compose|trash|settings)(?:\/(.*))?$/,
  );
  if (emailSection) {
    const section = emailSection[1]!;
    const rest = emailSection[2];
    if (
      rest &&
      section !== "compose" &&
      section !== "settings" &&
      !params.get("m")
    ) {
      try {
        params.set("m", decodeURIComponent(rest));
      } catch {
        params.set("m", rest);
      }
    }
    const qs = params.toString();
    return qs ? `/email/${section}?${qs}` : `/email/${section}`;
  }
  if (pathname === "/email" || pathname.startsWith("/email/")) {
    const qs = params.toString();
    return qs ? `${DEFAULT_EMAIL_PATH}?${qs}` : DEFAULT_EMAIL_PATH;
  }

  const accountMatch = pathname.match(
    /^\/accounts\/([^/]+)(?:\/(logs|settings|overview))?\/?$/,
  );
  if (accountMatch) {
    let email = accountMatch[1]!;
    try {
      email = decodeURIComponent(email);
    } catch {
      /* keep raw */
    }
    if (email.includes("@")) {
      const next = new URLSearchParams();
      next.set("email", email.trim().toLowerCase());
      const tabSeg = accountMatch[2];
      if (tabSeg === "logs" || tabSeg === "settings") {
        next.set("tab", tabSeg);
      }
      return `/accounts?${next.toString()}`;
    }
  }

  const audienceMatch = pathname.match(
    /^\/audience\/([^/]+)(?:\/(contacts|history|settings))?\/?$/,
  );
  if (audienceMatch) {
    let groupId = audienceMatch[1]!;
    try {
      groupId = decodeURIComponent(groupId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", groupId);
    const tabSeg = audienceMatch[2];
    if (tabSeg === "contacts" || tabSeg === "history" || tabSeg === "settings") {
      next.set("tab", tabSeg);
    }
    return `/audience?${next.toString()}`;
  }

  if (pathname === "/broadcasts/new") {
    return "/broadcasts?new=1";
  }
  const broadcastMatch = pathname.match(
    /^\/broadcasts\/([^/]+)(?:\/(audience|content|progress|overview))?\/?$/,
  );
  if (broadcastMatch) {
    let broadcastId = broadcastMatch[1]!;
    try {
      broadcastId = decodeURIComponent(broadcastId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", broadcastId);
    const tabSeg = broadcastMatch[2];
    if (
      tabSeg === "audience" ||
      tabSeg === "content" ||
      tabSeg === "progress"
    ) {
      next.set("tab", tabSeg);
    }
    return `/broadcasts?${next.toString()}`;
  }

  const crmCampaignMatch = pathname.match(
    /^\/crm\/campaigns\/([^/]+)(?:\/(content|publish|progress|overview))?\/?$/,
  );
  if (crmCampaignMatch) {
    let campaignId = crmCampaignMatch[1]!;
    try {
      campaignId = decodeURIComponent(campaignId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", campaignId);
    const tabSeg = crmCampaignMatch[2];
    if (tabSeg === "content" || tabSeg === "publish" || tabSeg === "progress") {
      next.set("tab", tabSeg === "progress" ? "publish" : tabSeg);
    }
    return `/crm/campaigns?${next.toString()}`;
  }

  // Settings: /settings/{tab} are real nested routes now. Collapse
  // cloudflare → /settings and rewrite legacy /settings?tab={tab} into
  // the nested path form so stored last-routes still restore.
  if (pathname === "/settings" || pathname === "/settings/") {
    const tab = params.get("tab");
    if (tab) {
      if (tab === "admin-token") {
        params.delete("tab");
        const qs = params.toString();
        return qs ? `/settings/worker?${qs}` : "/settings/worker";
      }
      const allowed = ["worker", "inbound-r2", "d1", "mailbox", "update"] as const;
      if ((allowed as readonly string[]).includes(tab)) {
        params.delete("tab");
        const qs = params.toString();
        return qs ? `/settings/${tab}?${qs}` : `/settings/${tab}`;
      }
    }
    return "/settings";
  }

  const settingsMatch = pathname.match(/^\/settings\/([^/]+)\/?$/);
  if (settingsMatch) {
    let tab = settingsMatch[1]!;
    try {
      tab = decodeURIComponent(tab);
    } catch {
      /* keep raw */
    }
    if (tab === "admin-token") return "/settings/worker";
    const allowed = [
      "cloudflare",
      "worker",
      "inbound-r2",
      "d1",
      "mailbox",
      "update",
    ] as const;
    if ((allowed as readonly string[]).includes(tab)) {
      return tab === "cloudflare" ? "/settings" : `/settings/${tab}`;
    }
  }

  if (pathname === "/" || !pathname.startsWith("/")) {
    return DEFAULT_DASHBOARD_PATH;
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** True when a stored path is safe to restore for the given mode. */
export function isRestorablePath(path: string, mode: SidebarMode): boolean {
  if (!path.startsWith("/")) return false;
  // Reject `/` before normalize (which maps it to the dashboard default).
  if (pathnameOnly(path) === "/") return false;
  const pathname = pathnameOnly(normalizeEntryPath(path));
  for (const prefix of BLOCKED_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return false;
  }
  if (mode === "email") return isEmailPathname(pathname);
  if (mode === "crm") return isCrmPathname(pathname);
  return !isEmailPathname(pathname) && !isCrmPathname(pathname);
}
