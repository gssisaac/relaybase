export type SidebarMode = "email" | "dashboard";

const MODE_PREFIX = "relaybase:sidebar:mode:";
const LAST_EMAIL_PREFIX = "relaybase:sidebar:lastPath:email:";
const LAST_DASHBOARD_PREFIX = "relaybase:sidebar:lastPath:dashboard:";

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

/** True when a stored path is safe to restore for the given mode. */
export function isRestorablePath(path: string, mode: SidebarMode): boolean {
  if (!path.startsWith("/")) return false;
  const pathname = pathnameOnly(path);
  if (pathname === "/") return false;
  for (const prefix of BLOCKED_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return false;
  }
  if (mode === "email") {
    return pathname === "/email" || pathname.startsWith("/email/");
  }
  return pathname !== "/email" && !pathname.startsWith("/email/");
}

export function readSidebarMode(userId: string): SidebarMode | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(`${MODE_PREFIX}${userId}`);
    return raw === "email" || raw === "dashboard" ? raw : null;
  } catch {
    return null;
  }
}

export function writeSidebarMode(userId: string, mode: SidebarMode) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${MODE_PREFIX}${userId}`, mode);
  } catch {
    // ignore
  }
}

export function readLastPath(userId: string, mode: SidebarMode): string {
  const fallback = mode === "email" ? DEFAULT_EMAIL_PATH : DEFAULT_DASHBOARD_PATH;
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const key =
      mode === "email"
        ? `${LAST_EMAIL_PREFIX}${userId}`
        : `${LAST_DASHBOARD_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (raw && isRestorablePath(raw, mode)) return raw;
  } catch {
    // ignore
  }
  return fallback;
}

export function writeLastPath(
  userId: string,
  mode: SidebarMode,
  path: string,
) {
  if (typeof window === "undefined" || !userId) return;
  if (!isRestorablePath(path, mode)) return;
  try {
    const key =
      mode === "email"
        ? `${LAST_EMAIL_PREFIX}${userId}`
        : `${LAST_DASHBOARD_PREFIX}${userId}`;
    localStorage.setItem(key, path);
  } catch {
    // ignore
  }
}

/** Last sidebar mode + path for app entry (home / post-login). */
export function resolveEntryPath(userId: string): string {
  const mode = readSidebarMode(userId) ?? "dashboard";
  return readLastPath(userId, mode);
}
