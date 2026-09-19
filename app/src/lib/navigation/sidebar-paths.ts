export type SidebarMode = "email" | "dashboard" | "studio";

export const DEFAULT_EMAIL_PATH = "/email/inbox";
export const DEFAULT_DASHBOARD_PATH = "/dashboard";
export const DEFAULT_STUDIO_PATH = "/studio/dashboard";

const BLOCKED_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/studio/login",
  "/studio/signup",
  "/worker/login",
  "/register",
  "/setup",
  "/api",
] as const;

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

function isStudioPathname(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

export function modeFromPathname(pathname: string): SidebarMode {
  if (isEmailPathname(pathname)) return "email";
  if (isStudioPathname(pathname)) return "studio";
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

  if (pathname === "/studio/layouts") {
    const qs = params.toString();
    return qs ? `/studio/settings/layouts?${qs}` : "/studio/settings/layouts";
  }

  if (pathname === "/studio/broadcasts" || pathname.startsWith("/studio/broadcasts/")) {
    pathname = pathname.replace(/^\/studio\/broadcasts(?=\/|$)/, "/studio/newsletters");
  }
  if (pathname === "/studio/automations" || pathname.startsWith("/studio/automations/")) {
    pathname = pathname.replace(/^\/studio\/automations(?=\/|$)/, "/studio/triggers");
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

  const studioSubscribersNested = pathname.match(
    /^\/studio\/subscribers\/([^/]+)(?:\/(contacts|history|settings))?\/?$/,
  );
  if (studioSubscribersNested) {
    let groupId = studioSubscribersNested[1]!;
    try {
      groupId = decodeURIComponent(groupId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", groupId);
    const tabSeg = studioSubscribersNested[2];
    if (tabSeg === "contacts" || tabSeg === "history" || tabSeg === "settings") {
      next.set("tab", tabSeg);
    }
    return `/studio/subscribers?${next.toString()}`;
  }

  const studioAudienceLegacyNested = pathname.match(
    /^\/studio\/audience\/([^/]+)(?:\/(contacts|history|settings))?\/?$/,
  );
  if (studioAudienceLegacyNested) {
    let groupId = studioAudienceLegacyNested[1]!;
    try {
      groupId = decodeURIComponent(groupId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", groupId);
    const tabSeg = studioAudienceLegacyNested[2];
    if (tabSeg === "contacts" || tabSeg === "history" || tabSeg === "settings") {
      next.set("tab", tabSeg);
    }
    return `/studio/subscribers?${next.toString()}`;
  }

  const subscribersMatch = pathname.match(
    /^\/subscribers\/([^/]+)(?:\/(contacts|history|settings))?\/?$/,
  );
  if (subscribersMatch) {
    let groupId = subscribersMatch[1]!;
    try {
      groupId = decodeURIComponent(groupId);
    } catch {
      /* keep raw */
    }
    const next = new URLSearchParams();
    next.set("id", groupId);
    const tabSeg = subscribersMatch[2];
    if (tabSeg === "contacts" || tabSeg === "history" || tabSeg === "settings") {
      next.set("tab", tabSeg);
    }
    return `/studio/subscribers?${next.toString()}`;
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
    return `/studio/subscribers?${next.toString()}`;
  }

  if (
    pathname === "/subscribers" ||
    pathname.startsWith("/subscribers/") ||
    pathname === "/subscribers" ||
    pathname.startsWith("/audience/")
  ) {
    const qs = params.toString();
    return qs ? `/studio/subscribers?${qs}` : "/studio/subscribers";
  }

  if (pathname === "/broadcasts/new") {
    return "/studio/newsletters?new=1";
  }

  if (pathname === "/studio/newsletters") {
    const newsletterId = params.get("id")?.trim();
    if (newsletterId) {
      const tabRaw = params.get("tab")?.trim().toLowerCase();
      params.delete("id");
      params.delete("tab");
      let tabPath = "";
      if (tabRaw === "audience" || tabRaw === "recipients") {
        tabPath = "/recipients";
      } else if (
        tabRaw &&
        tabRaw !== "content" &&
        (tabRaw === "publish" ||
          tabRaw === "stats" ||
          tabRaw === "settings")
      ) {
        tabPath = `/${tabRaw}`;
      }
      const qs = params.toString();
      const base = `/studio/newsletters/${encodeURIComponent(newsletterId)}${tabPath}`;
      return qs ? `${base}?${qs}` : base;
    }
  }

  const studioNewsletterSection = pathname.match(/^\/studio\/newsletters\/(sent|in-progress)\/?$/);
  if (studioNewsletterSection) {
    return `/studio/newsletters/${studioNewsletterSection[1]}`;
  }

  const studioNewsletterMatch = pathname.match(
    /^\/studio\/newsletters\/([^/]+)(?:\/(audience|recipients|content|publish|stats|settings))?\/?$/,
  );
  if (studioNewsletterMatch) {
    const segment = studioNewsletterMatch[1]!;
    if (segment !== "sent" && segment !== "in-progress" && segment !== "edit") {
      let newsletterId = segment;
      try {
        newsletterId = decodeURIComponent(newsletterId);
      } catch {
        /* keep raw */
      }
      const tabSeg = studioNewsletterMatch[2];
      let tabPath = "";
      if (tabSeg === "audience" || tabSeg === "recipients") {
        tabPath = "/recipients";
      } else if (
        tabSeg === "content" ||
        tabSeg === "publish" ||
        tabSeg === "stats" ||
        tabSeg === "settings"
      ) {
        tabPath = `/${tabSeg}`;
      }
      const qs = params.toString();
      const base = `/studio/newsletters/${encodeURIComponent(newsletterId)}${tabPath}`;
      return qs ? `${base}?${qs}` : base;
    }
  }

  const studioTriggerEditMatch = pathname.match(/^\/studio\/triggers\/([^/]+)\/(content|edit)\/?$/);
  if (studioTriggerEditMatch) {
    let triggerId = studioTriggerEditMatch[1]!;
    if (triggerId !== "edit") {
      try {
        triggerId = decodeURIComponent(triggerId);
      } catch {
        /* keep raw */
      }
      const next = new URLSearchParams();
      next.set("id", triggerId);
      return `/studio/triggers/edit?${next.toString()}`;
    }
  }

  const studioTriggerMatch = pathname.match(
    /^\/studio\/triggers\/([^/]+)(?:\/(config|preview|content|trigger|activity|stats|settings))?\/?$/,
  );
  if (studioTriggerMatch) {
    let triggerId = studioTriggerMatch[1]!;
    if (triggerId !== "edit") {
      try {
        triggerId = decodeURIComponent(triggerId);
      } catch {
        /* keep raw */
      }
      const tabSeg = studioTriggerMatch[2];
      if (tabSeg === "content") {
        const next = new URLSearchParams();
        next.set("id", triggerId);
        return `/studio/triggers/edit?${next.toString()}`;
      }
      const next = new URLSearchParams();
      next.set("id", triggerId);
      if (tabSeg === "stats") {
        next.set("tab", "stats");
      } else if (tabSeg === "activity") {
        next.set("tab", "stats");
      } else if (
        tabSeg === "config" ||
        tabSeg === "preview" ||
        tabSeg === "trigger" ||
        tabSeg === "settings"
      ) {
        next.set("tab", "config");
      }
      return `/studio/triggers?${next.toString()}`;
    }
  }

  const studioBroadcastSection = pathname.match(/^\/studio\/broadcasts\/(sent|in-progress)\/?$/);
  if (studioBroadcastSection) {
    return `/studio/newsletters/${studioBroadcastSection[1]}`;
  }
  const legacyBroadcastSection = pathname.match(/^\/broadcasts\/(sent|in-progress)\/?$/);
  if (legacyBroadcastSection) {
    return `/studio/newsletters/${legacyBroadcastSection[1]}`;
  }
  const broadcastMatch = pathname.match(
    /^\/broadcasts\/([^/]+)(?:\/(audience|recipients|content|progress|overview))?\/?$/,
  );
  if (broadcastMatch) {
    let newsletterId = broadcastMatch[1]!;
    try {
      newsletterId = decodeURIComponent(newsletterId);
    } catch {
      /* keep raw */
    }
    const tabSeg = broadcastMatch[2];
    let tabPath = "";
    if (tabSeg === "audience" || tabSeg === "recipients") {
      tabPath = "/recipients";
    } else if (tabSeg === "content") {
      tabPath = "/content";
    } else if (tabSeg === "progress") {
      tabPath = "/stats";
    }
    const qs = params.toString();
    const base = `/studio/newsletters/${encodeURIComponent(newsletterId)}${tabPath}`;
    return qs ? `${base}?${qs}` : base;
  }

  const studioBroadcastMatch = pathname.match(
    /^\/studio\/broadcasts\/([^/]+)(?:\/(audience|recipients|content|publish|stats|settings))?\/?$/,
  );
  if (studioBroadcastMatch) {
    let newsletterId = studioBroadcastMatch[1]!;
    try {
      newsletterId = decodeURIComponent(newsletterId);
    } catch {
      /* keep raw */
    }
    const tabSeg = studioBroadcastMatch[2];
    let tabPath = "";
    if (tabSeg === "audience" || tabSeg === "recipients") {
      tabPath = "/recipients";
    } else if (
      tabSeg === "content" ||
      tabSeg === "publish" ||
      tabSeg === "stats" ||
      tabSeg === "settings"
    ) {
      tabPath = `/${tabSeg}`;
    }
    const qs = params.toString();
    const base = `/studio/newsletters/${encodeURIComponent(newsletterId)}${tabPath}`;
    return qs ? `${base}?${qs}` : base;
  }

  const studioAutomationEditMatch = pathname.match(
    /^\/studio\/automations\/([^/]+)\/(content|edit)\/?$/,
  );
  if (studioAutomationEditMatch) {
    let triggerId = studioAutomationEditMatch[1]!;
    if (triggerId !== "edit") {
      try {
        triggerId = decodeURIComponent(triggerId);
      } catch {
        /* keep raw */
      }
      const next = new URLSearchParams();
      next.set("id", triggerId);
      return `/studio/triggers/edit?${next.toString()}`;
    }
  }

  const studioAutomationMatch = pathname.match(
    /^\/studio\/automations\/([^/]+)(?:\/(preview|content|trigger|activity|stats|settings))?\/?$/,
  );
  if (studioAutomationMatch) {
    let triggerId = studioAutomationMatch[1]!;
    if (triggerId !== "edit") {
      try {
        triggerId = decodeURIComponent(triggerId);
      } catch {
        /* keep raw */
      }
      const tabSeg = studioAutomationMatch[2];
      if (tabSeg === "content") {
        const next = new URLSearchParams();
        next.set("id", triggerId);
        return `/studio/triggers/edit?${next.toString()}`;
      }
      const next = new URLSearchParams();
      next.set("id", triggerId);
      if (tabSeg === "preview" || tabSeg === "trigger" || tabSeg === "stats" || tabSeg === "settings") {
        next.set("tab", tabSeg);
      } else if (tabSeg === "activity") {
        next.set("tab", "stats");
      }
      return `/studio/triggers?${next.toString()}`;
    }
  }

  if (pathname === "/automations" || pathname.startsWith("/automations/")) {
    const qs = params.toString();
    return qs ? `/studio/triggers?${qs}` : "/studio/triggers";
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
  if (mode === "studio") return isStudioPathname(pathname);
  return !isEmailPathname(pathname) && !isStudioPathname(pathname);
}
