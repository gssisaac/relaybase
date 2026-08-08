export type SidebarMode = "email" | "dashboard";

const MODE_PREFIX = "relaybase:sidebar:mode:";
const LAST_EMAIL_PREFIX = "relaybase:sidebar:lastPath:email:";
const LAST_DASHBOARD_PREFIX = "relaybase:sidebar:lastPath:dashboard:";

export const DEFAULT_EMAIL_PATH = "/email/inbox";
export const DEFAULT_DASHBOARD_PATH = "/dashboard";

export function modeFromPathname(pathname: string): SidebarMode {
  return pathname === "/email" || pathname.startsWith("/email/")
    ? "email"
    : "dashboard";
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
  if (typeof window === "undefined" || !userId) {
    return mode === "email" ? DEFAULT_EMAIL_PATH : DEFAULT_DASHBOARD_PATH;
  }
  try {
    const key =
      mode === "email"
        ? `${LAST_EMAIL_PREFIX}${userId}`
        : `${LAST_DASHBOARD_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (raw && raw.startsWith("/")) return raw;
  } catch {
    // ignore
  }
  return mode === "email" ? DEFAULT_EMAIL_PATH : DEFAULT_DASHBOARD_PATH;
}

export function writeLastPath(
  userId: string,
  mode: SidebarMode,
  path: string,
) {
  if (typeof window === "undefined" || !userId || !path.startsWith("/")) return;
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
