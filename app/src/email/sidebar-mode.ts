import { readUiJson, UI_FILES, writeUiJson } from "@/email/user-ui-disk";
import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  isRestorablePath,
  modeFromPathname,
  normalizeEntryPath,
  type SidebarMode,
} from "@/email/sidebar-paths";

export type { SidebarMode };
export {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  isRestorablePath,
  modeFromPathname,
  normalizeEntryPath,
};

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
  if (raw && isRestorablePath(raw, mode)) return normalizeEntryPath(raw);
  return fallback;
}

export function writeLastPath(
  userId: string,
  mode: SidebarMode,
  path: string,
) {
  if (typeof window === "undefined" || !userId) return;
  const normalized = normalizeEntryPath(path);
  if (!isRestorablePath(normalized, mode)) return;
  const prev = readLocalSidebar(userId);
  const next: SidebarUiState =
    mode === "email"
      ? { ...prev, lastEmailPath: normalized }
      : { ...prev, lastDashboardPath: normalized };
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
    const emailPath =
      typeof disk.lastEmailPath === "string"
        ? normalizeEntryPath(disk.lastEmailPath)
        : null;
    const dashPath =
      typeof disk.lastDashboardPath === "string"
        ? normalizeEntryPath(disk.lastDashboardPath)
        : null;
    const state: SidebarUiState = {
      mode,
      lastEmailPath:
        emailPath && isRestorablePath(emailPath, "email") ? emailPath : null,
      lastDashboardPath:
        dashPath && isRestorablePath(dashPath, "dashboard") ? dashPath : null,
      collapsed: Boolean(disk.collapsed),
    };
    writeLocalSidebar(userId, state);
    return state;
  }

  const local = readLocalSidebar(userId);
  const migrated: SidebarUiState = {
    ...local,
    lastEmailPath: local.lastEmailPath
      ? normalizeEntryPath(local.lastEmailPath)
      : null,
    lastDashboardPath: local.lastDashboardPath
      ? normalizeEntryPath(local.lastDashboardPath)
      : null,
  };
  if (
    migrated.mode ||
    migrated.lastEmailPath ||
    migrated.lastDashboardPath ||
    migrated.collapsed
  ) {
    writeLocalSidebar(userId, migrated);
    await writeUiJson(userId, UI_FILES.sidebar, migrated);
  }
  return migrated;
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
