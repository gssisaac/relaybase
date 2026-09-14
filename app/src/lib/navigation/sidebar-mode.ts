import { readUiJson, UI_FILES, writeUiJson } from "@/email/lib/disk/user-ui-disk";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import {
  DEFAULT_CRM_PATH,
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  isRestorablePath,
  modeFromPathname,
  normalizeEntryPath,
  type SidebarMode,
} from "@/lib/navigation/sidebar-paths";

export type { SidebarMode };
export {
  DEFAULT_CRM_PATH,
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
  lastCrmPath: string | null;
  collapsed: boolean;
};

const MODE_PREFIX = "relaybase:sidebar:mode:";
const LAST_EMAIL_PREFIX = "relaybase:sidebar:lastPath:email:";
const LAST_DASHBOARD_PREFIX = "relaybase:sidebar:lastPath:dashboard:";
const LAST_CRM_PREFIX = "relaybase:sidebar:lastPath:crm:";
const COLLAPSED_PREFIX = "relaybase:sidebar-collapsed:";

const DEFAULT_PATH_BY_MODE: Record<SidebarMode, string> = {
  email: DEFAULT_EMAIL_PATH,
  dashboard: DEFAULT_DASHBOARD_PATH,
  crm: DEFAULT_CRM_PATH,
};

type LastPathField = "lastEmailPath" | "lastDashboardPath" | "lastCrmPath";

function lastPathField(mode: SidebarMode): LastPathField {
  if (mode === "email") return "lastEmailPath";
  if (mode === "crm") return "lastCrmPath";
  return "lastDashboardPath";
}

function isSidebarMode(value: unknown): value is SidebarMode {
  return value === "email" || value === "dashboard" || value === "crm";
}

function readLocalSidebar(userId: string): SidebarUiState {
  const empty: SidebarUiState = {
    mode: null,
    lastEmailPath: null,
    lastDashboardPath: null,
    lastCrmPath: null,
    collapsed: false,
  };
  if (typeof window === "undefined" || !userId) return empty;
  try {
    const modeRaw = localStorage.getItem(`${MODE_PREFIX}${userId}`);
    const mode = isSidebarMode(modeRaw) ? modeRaw : null;
    const emailRaw = localStorage.getItem(`${LAST_EMAIL_PREFIX}${userId}`);
    const dashRaw = localStorage.getItem(`${LAST_DASHBOARD_PREFIX}${userId}`);
    const crmRaw = localStorage.getItem(`${LAST_CRM_PREFIX}${userId}`);
    const collapsed =
      localStorage.getItem(`${COLLAPSED_PREFIX}${userId}`) === "1";
    return {
      mode,
      lastEmailPath:
        emailRaw && isRestorablePath(emailRaw, "email") ? emailRaw : null,
      lastDashboardPath:
        dashRaw && isRestorablePath(dashRaw, "dashboard") ? dashRaw : null,
      lastCrmPath: crmRaw && isRestorablePath(crmRaw, "crm") ? crmRaw : null,
      collapsed,
    };
  } catch {
    return empty;
  }
}

function writeLocalSidebar(userId: string, state: SidebarUiState) {
  if (typeof window === "undefined" || !userId) return;
  if (isDesktopRuntime()) return;
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
    if (state.lastCrmPath) {
      localStorage.setItem(`${LAST_CRM_PREFIX}${userId}`, state.lastCrmPath);
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
  const state = readLocalSidebar(userId);
  const raw = state[lastPathField(mode)];
  if (raw && isRestorablePath(raw, mode)) return normalizeEntryPath(raw);
  return DEFAULT_PATH_BY_MODE[mode];
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
  const next: SidebarUiState = { ...prev, [lastPathField(mode)]: normalized };
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
    lastCrmPath: null,
    collapsed: false,
  };
  if (!userId) return empty;

  const disk = await readUiJson<Partial<SidebarUiState>>(
    userId,
    UI_FILES.sidebar,
  );
  if (disk && typeof disk === "object") {
    const mode = isSidebarMode(disk.mode) ? disk.mode : null;
    const emailPath =
      typeof disk.lastEmailPath === "string"
        ? normalizeEntryPath(disk.lastEmailPath)
        : null;
    const dashPath =
      typeof disk.lastDashboardPath === "string"
        ? normalizeEntryPath(disk.lastDashboardPath)
        : null;
    const crmPath =
      typeof disk.lastCrmPath === "string"
        ? normalizeEntryPath(disk.lastCrmPath)
        : null;
    const state: SidebarUiState = {
      mode,
      lastEmailPath:
        emailPath && isRestorablePath(emailPath, "email") ? emailPath : null,
      lastDashboardPath:
        dashPath && isRestorablePath(dashPath, "dashboard") ? dashPath : null,
      lastCrmPath:
        crmPath && isRestorablePath(crmPath, "crm") ? crmPath : null,
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
    lastCrmPath: local.lastCrmPath
      ? normalizeEntryPath(local.lastCrmPath)
      : null,
  };
  if (
    migrated.mode ||
    migrated.lastEmailPath ||
    migrated.lastDashboardPath ||
    migrated.lastCrmPath ||
    migrated.collapsed
  ) {
    writeLocalSidebar(userId, migrated);
    await writeUiJson(userId, UI_FILES.sidebar, migrated);
  }
  return migrated;
}

/** App entry is always the last mail path. Dashboard/CRM last path is sidebar-only. */
export function resolveEntryPath(userId: string): string {
  return readLastPath(userId, "email");
}

export async function resolveEntryPathAsync(userId: string): Promise<string> {
  await hydrateSidebarState(userId);
  return resolveEntryPath(userId);
}
