export type SidebarMode = "email" | "dashboard" | "scale";

export const DEFAULT_EMAIL_PATH = "/email/inbox";
export const DEFAULT_DASHBOARD_PATH = "/dashboard";
export const DEFAULT_SCALE_PATH = "/scale/audience";

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

function isScalePathname(pathname: string): boolean {
  return pathname === "/scale" || pathname.startsWith("/scale/");
}

export function modeFromPathname(pathname: string): SidebarMode {
  if (isEmailPathname(pathname)) return "email";
  if (isScalePathname(pathname)) return "scale";
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
  let pathname = pathnamePart || "/";
  const params = new URLSearchParams(query);

  if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    pathname = pathname.replace(/^\/crm(?=\/|$)/, "/scale");
  }

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

  const scaleAudienceMatch = pathname.match(
    /^\/scale\/audience\/([^/]+)(?:\/(contacts|history|settings))?\/?$/,
  );
  if (scaleAudienceMatch) {
    let groupId = scaleAudienceMatch[1]!;
    try {
      groupId = decodeURIComponent(groupId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", groupId);
    const tabSeg = scaleAudienceMatch[2];
    if (tabSeg === "contacts" || tabSeg === "history" || tabSeg === "settings") {
      next.set("tab", tabSeg);
    }
    return `/scale/audience?${next.toString()}`;
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
    return `/scale/audience?${next.toString()}`;
  }

  if (pathname === "/audience" || pathname.startsWith("/audience/")) {
    const qs = params.toString();
    return qs ? `/scale/audience?${qs}` : "/scale/audience";
  }

  if (pathname === "/broadcasts/new") {
    return "/scale/broadcasts?new=1";
  }
  const scaleBroadcastSection = pathname.match(/^\/scale\/broadcasts\/(sent|in-progress)\/?$/);
  if (scaleBroadcastSection) {
    return `/scale/broadcasts?view=${scaleBroadcastSection[1]}`;
  }
  const legacyCrmBroadcastSection = pathname.match(/^\/crm\/broadcasts\/(sent|in-progress)\/?$/);
  if (legacyCrmBroadcastSection) {
    return `/scale/broadcasts?view=${legacyCrmBroadcastSection[1]}`;
  }
  const legacyBroadcastSection = pathname.match(/^\/broadcasts\/(sent|in-progress)\/?$/);
  if (legacyBroadcastSection) {
    return `/scale/broadcasts?view=${legacyBroadcastSection[1]}`;
  }
  const broadcastMatch = pathname.match(
    /^\/broadcasts\/([^/]+)(?:\/(audience|recipients|content|progress|overview))?\/?$/,
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
    if (tabSeg === "audience" || tabSeg === "recipients") {
      next.set("tab", "recipients");
    } else if (tabSeg === "content" || tabSeg === "progress") {
      next.set("tab", tabSeg === "progress" ? "stats" : tabSeg);
    }
    return `/scale/broadcasts?${next.toString()}`;
  }

  const scaleBroadcastMatch = pathname.match(
    /^\/scale\/broadcasts\/([^/]+)(?:\/(audience|recipients|content|publish|stats|settings))?\/?$/,
  );
  if (scaleBroadcastMatch) {
    let broadcastId = scaleBroadcastMatch[1]!;
    try {
      broadcastId = decodeURIComponent(broadcastId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", broadcastId);
    const tabSeg = scaleBroadcastMatch[2];
    if (tabSeg === "audience" || tabSeg === "recipients") {
      next.set("tab", "recipients");
    } else if (
      tabSeg === "content" ||
      tabSeg === "publish" ||
      tabSeg === "stats" ||
      tabSeg === "settings"
    ) {
      next.set("tab", tabSeg);
    }
    return `/scale/broadcasts?${next.toString()}`;
  }

  const legacyCrmBroadcastMatch = pathname.match(
    /^\/crm\/broadcasts\/([^/]+)(?:\/(audience|recipients|content|publish|stats|settings))?\/?$/,
  );
  if (legacyCrmBroadcastMatch) {
    let broadcastId = legacyCrmBroadcastMatch[1]!;
    try {
      broadcastId = decodeURIComponent(broadcastId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", broadcastId);
    const tabSeg = legacyCrmBroadcastMatch[2];
    if (tabSeg === "audience" || tabSeg === "recipients") {
      next.set("tab", "recipients");
    } else if (
      tabSeg === "content" ||
      tabSeg === "publish" ||
      tabSeg === "stats" ||
      tabSeg === "settings"
    ) {
      next.set("tab", tabSeg);
    }
    return `/scale/broadcasts?${next.toString()}`;
  }

  const legacyCrmAutomationMatch = pathname.match(
    /^\/crm\/automations\/([^/]+)(?:\/(content|trigger|activity|stats|settings))?\/?$/,
  );
  if (legacyCrmAutomationMatch) {
    let automationId = legacyCrmAutomationMatch[1]!;
    try {
      automationId = decodeURIComponent(automationId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", automationId);
    const tabSeg = legacyCrmAutomationMatch[2];
    if (tabSeg === "content" || tabSeg === "trigger" || tabSeg === "stats" || tabSeg === "settings") {
      next.set("tab", tabSeg);
    } else if (tabSeg === "activity") {
      next.set("tab", "stats");
    }
    return `/scale/automations?${next.toString()}`;
  }

  if (pathname === "/automations" || pathname.startsWith("/automations/")) {
    const qs = params.toString();
    return qs ? `/scale/automations?${qs}` : "/scale/automations";
  }

  const legacyCrmCampaignMatch = pathname.match(
    /^\/crm\/campaigns(?:\/([^/]+))?(?:\/(content|publish|progress|overview))?\/?$/,
  );
  if (legacyCrmCampaignMatch) {
    const next = new URLSearchParams();
    const legacyId = legacyCrmCampaignMatch[1];
    if (legacyId) {
      try {
        next.set("id", decodeURIComponent(legacyId));
      } catch {
        next.set("id", legacyId);
      }
    }
    const tabSeg = legacyCrmCampaignMatch[2];
    if (tabSeg === "content" || tabSeg === "publish" || tabSeg === "progress") {
      next.set("tab", tabSeg === "progress" ? "publish" : tabSeg);
    }
    return `/scale/broadcasts?${next.toString()}`;
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
  if (mode === "scale") return isScalePathname(pathname);
  return !isEmailPathname(pathname) && !isScalePathname(pathname);
}
