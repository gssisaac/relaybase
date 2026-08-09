import {
  desktopGetEmailPrefs,
  desktopSaveEmailPrefs,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import type { AccountColorMap } from "@/email/account-colors";

export type EmailPrefs = {
  version: 1;
  accountColors: AccountColorMap;
};

const LOCAL_KEY = "relaybase:email.json";

export function emptyEmailPrefs(): EmailPrefs {
  return { version: 1, accountColors: {} };
}

function normalizePrefs(raw: unknown): EmailPrefs {
  if (!raw || typeof raw !== "object") return emptyEmailPrefs();
  const obj = raw as { version?: unknown; accountColors?: unknown };
  const colors: AccountColorMap = {};
  if (obj.accountColors && typeof obj.accountColors === "object") {
    for (const [key, value] of Object.entries(
      obj.accountColors as Record<string, unknown>,
    )) {
      if (typeof key === "string" && typeof value === "string" && value) {
        colors[key.trim().toLowerCase()] = value;
      }
    }
  }
  return { version: 1, accountColors: colors };
}

function readLocalPrefs(): EmailPrefs {
  if (typeof window === "undefined") return emptyEmailPrefs();
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyEmailPrefs();
    return normalizePrefs(JSON.parse(raw) as unknown);
  } catch {
    return emptyEmailPrefs();
  }
}

function writeLocalPrefs(prefs: EmailPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

export async function loadEmailPrefs(): Promise<EmailPrefs> {
  if (isDesktopRuntime()) {
    const remote = await desktopGetEmailPrefs();
    if (remote) {
      const normalized = normalizePrefs(remote);
      writeLocalPrefs(normalized);
      return normalized;
    }
    // Disk miss: allow one-time migrate from legacy localhost localStorage.
    return readLocalPrefs();
  }
  return readLocalPrefs();
}

export async function saveEmailPrefs(prefs: EmailPrefs): Promise<void> {
  const normalized = normalizePrefs(prefs);
  if (isDesktopRuntime()) {
    // Disk first — do not treat localhost localStorage as durable.
    await desktopSaveEmailPrefs(normalized);
    writeLocalPrefs(normalized);
    return;
  }
  writeLocalPrefs(normalized);
}
