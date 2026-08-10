export type SidebarMode = "email" | "dashboard";

export const DEFAULT_EMAIL_PATH = "/email/inbox";
export const DEFAULT_DASHBOARD_PATH = "/dashboard";

const BLOCKED_PATH_PREFIXES = ["/login", "/register", "/setup", "/api"] as const;

export function modeFromPathname(pathname: string): SidebarMode {
  return pathname === "/email" || pathname.startsWith("/email/")
    ? "email"
    : "dashboard";
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
    /^\/email\/(inbox|drafts|sent|compose|trash)(?:\/(.*))?$/,
  );
  if (emailSection) {
    const section = emailSection[1]!;
    const rest = emailSection[2];
    if (rest && section !== "compose" && !params.get("m")) {
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
    /^\/audience\/([^/]+)(?:\/(contacts|send|progress|history|settings|overview))?\/?$/,
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
    if (
      tabSeg === "contacts" ||
      tabSeg === "send" ||
      tabSeg === "progress" ||
      tabSeg === "history" ||
      tabSeg === "settings"
    ) {
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
  if (mode === "email") {
    return pathname === "/email" || pathname.startsWith("/email/");
  }
  return pathname !== "/email" && !pathname.startsWith("/email/");
}
