import { readUiJson, UI_FILES, writeUiJson } from "@/email/user-ui-disk";

export type SidebarMode = "email" | "dashboard";

export type SidebarUiState = {
  mode: SidebarMode | null;
  lastEmailPath: string | null;
  lastDashboardPath: string | null;
  collapsed: boolean;
};

const MODE_PREFIX = "relaybase:sidebar:mode:";
const LAST_EMAIL_PREFIX = "relaybase:sidebar:lastPath:email:";
const LAST_DASHBOARD_PREFIX = "relaybase:sidebar:lastPath:dashboard:";
const COLLAPSED_PREFIX = "relaybase:sidebar-collapsed:";

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

function readLocalSidebar(userId: string): SidebarUiState {
  const empty: SidebarUiState = {
    mode: null,
    lastEmailPath: null,
    lastDashboardPath: null,
    collapsed: false,
  };
  if (typeof window === "undefined" || !userId) return empty;
  try {
    const modeRaw = localStorage.getItem(`${MODE_PREFIX}${userId}`);
    const mode =
      modeRaw === "email" || modeRaw === "dashboard" ? modeRaw : null;
    const emailRaw = localStorage.getItem(`${LAST_EMAIL_PREFIX}${userId}`);
    const dashRaw = localStorage.getItem(`${LAST_DASHBOARD_PREFIX}${userId}`);
    const collapsed =
      localStorage.getItem(`${COLLAPSED_PREFIX}${userId}`) === "1";
    return {
      mode,
      lastEmailPath:
        emailRaw && isRestorablePath(emailRaw, "email") ? emailRaw : null,
      lastDashboardPath:
        dashRaw && isRestorablePath(dashRaw, "dashboard") ? dashRaw : null,
      collapsed,
    };
  } catch {
    return empty;
  }
}

function writeLocalSidebar(userId: string, state: SidebarUiState) {
  if (typeof window === "undefined" || !userId) return;
  try {
    if (state.mode) {
      localStorage.setItem(`${MODE_PREFIX}${userId}`, state.mode);
    }
    if (state.lastEmailPath) {
      localStorage.setItem(
        `${LAST_EMAIL_PREFIX}${userId}`,
        state.lastEmailPath,
      );
    }
    if (state.lastDashboardPath) {
      localStorage.setItem(
        `${LAST_DASHBOARD_PREFIX}${userId}`,
        state.lastDashboardPath,
      );
    }
    localStorage.setItem(
      `${COLLAPSED_PREFIX}${userId}`,
      state.collapsed ? "1" : "0",
    );
  } catch {
    // ignore
  }
}

function persistSidebarDisk(userId: string, state: SidebarUiState) {
  void writeUiJson(userId, UI_FILES.sidebar, state).catch((err) => {
    console.error("[relaybase] failed to persist sidebar state", err);
  });
}

export function readSidebarMode(userId: string): SidebarMode | null {
  return readLocalSidebar(userId).mode;
}

export function writeSidebarMode(userId: string, mode: SidebarMode) {
  if (typeof window === "undefined" || !userId) return;
  const next = { ...readLocalSidebar(userId), mode };
  writeLocalSidebar(userId, next);
  persistSidebarDisk(userId, next);
}

export function readLastPath(userId: string, mode: SidebarMode): string {
  const fallback = mode === "email" ? DEFAULT_EMAIL_PATH : DEFAULT_DASHBOARD_PATH;
  const state = readLocalSidebar(userId);
  const raw = mode === "email" ? state.lastEmailPath : state.lastDashboardPath;
  if (raw && isRestorablePath(raw, mode)) return raw;
  return fallback;
}

export function writeLastPath(
  userId: string,
  mode: SidebarMode,
  path: string,
) {
  if (typeof window === "undefined" || !userId) return;
  if (!isRestorablePath(path, mode)) return;
  const prev = readLocalSidebar(userId);
  const next: SidebarUiState =
    mode === "email"
      ? { ...prev, lastEmailPath: path }
      : { ...prev, lastDashboardPath: path };
  writeLocalSidebar(userId, next);
  persistSidebarDisk(userId, next);
}

export function readSidebarCollapsed(userId: string): boolean {
  return readLocalSidebar(userId).collapsed;
}

export function writeSidebarCollapsed(userId: string, collapsed: boolean) {
  if (typeof window === "undefined" || !userId) return;
  const next = { ...readLocalSidebar(userId), collapsed };
  writeLocalSidebar(userId, next);
  persistSidebarDisk(userId, next);
}

/** Load from ~/.relaybase (desktop), migrate legacy localStorage once. */
export async function hydrateSidebarState(userId: string): Promise<SidebarUiState> {
  const empty: SidebarUiState = {
    mode: null,
    lastEmailPath: null,
    lastDashboardPath: null,
    collapsed: false,
  };
  if (!userId) return empty;

  const disk = await readUiJson<Partial<SidebarUiState>>(
    userId,
    UI_FILES.sidebar,
  );
  if (disk && typeof disk === "object") {
    const mode =
      disk.mode === "email" || disk.mode === "dashboard" ? disk.mode : null;
    const state: SidebarUiState = {
      mode,
      lastEmailPath:
        typeof disk.lastEmailPath === "string" &&
        isRestorablePath(disk.lastEmailPath, "email")
          ? disk.lastEmailPath
          : null,
      lastDashboardPath:
        typeof disk.lastDashboardPath === "string" &&
        isRestorablePath(disk.lastDashboardPath, "dashboard")
          ? disk.lastDashboardPath
          : null,
      collapsed: Boolean(disk.collapsed),
    };
    writeLocalSidebar(userId, state);
    return state;
  }

  const local = readLocalSidebar(userId);
  if (
    local.mode ||
    local.lastEmailPath ||
    local.lastDashboardPath ||
    local.collapsed
  ) {
    await writeUiJson(userId, UI_FILES.sidebar, local);
  }
  return local;
}

/** Last sidebar mode + path for app entry (home / post-login). */
export function resolveEntryPath(userId: string): string {
  const mode = readSidebarMode(userId) ?? "dashboard";
  return readLastPath(userId, mode);
}

export async function resolveEntryPathAsync(userId: string): Promise<string> {
  await hydrateSidebarState(userId);
  return resolveEntryPath(userId);
}
