import { readUiJson, UI_FILES, writeUiJson } from "@/email/user-ui-disk";

/** Expanded domain cards on Accounts — default is collapsed (compact). */
export type AccountsUiState = {
  version: 1;
  /** Domains whose cards are expanded. Missing domains are collapsed. */
  expandedDomains: string[];
};

const LOCAL_PREFIX = "relaybase:accounts-ui:";

function emptyState(): AccountsUiState {
  return { version: 1, expandedDomains: [] };
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

function normalizeState(raw: Partial<AccountsUiState> | null): AccountsUiState {
  if (!raw || typeof raw !== "object") return emptyState();
  const list = Array.isArray(raw.expandedDomains) ? raw.expandedDomains : [];
  const expandedDomains = [
    ...new Set(
      list
        .filter((d): d is string => typeof d === "string")
        .map(normalizeDomain)
        .filter(Boolean),
    ),
  ];
  return { version: 1, expandedDomains };
}

function readLocal(userId: string): AccountsUiState {
  if (typeof window === "undefined" || !userId) return emptyState();
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${userId}`);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw) as Partial<AccountsUiState>);
  } catch {
    return emptyState();
  }
}

function writeLocal(userId: string, state: AccountsUiState) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${userId}`, JSON.stringify(state));
  } catch {
    // quota / private mode
  }
}

function persistDisk(userId: string, state: AccountsUiState) {
  void writeUiJson(userId, UI_FILES.accounts, state).catch((err) => {
    console.error("[relaybase] failed to persist accounts UI state", err);
  });
}

export function readExpandedDomains(userId: string): Set<string> {
  return new Set(readLocal(userId).expandedDomains);
}

export function writeExpandedDomains(userId: string, expanded: Set<string>) {
  if (typeof window === "undefined" || !userId) return;
  const state: AccountsUiState = {
    version: 1,
    expandedDomains: [...expanded].map(normalizeDomain).filter(Boolean),
  };
  writeLocal(userId, state);
  persistDisk(userId, state);
}

export function isDomainExpanded(userId: string, domain: string): boolean {
  return readExpandedDomains(userId).has(normalizeDomain(domain));
}

export function setDomainExpanded(
  userId: string,
  domain: string,
  expanded: boolean,
) {
  if (typeof window === "undefined" || !userId) return;
  const key = normalizeDomain(domain);
  if (!key) return;
  const next = readExpandedDomains(userId);
  if (expanded) next.add(key);
  else next.delete(key);
  writeExpandedDomains(userId, next);
}

/** Load from ~/.relaybase (desktop), migrate legacy localStorage once. */
export async function hydrateAccountsUiState(
  userId: string,
): Promise<AccountsUiState> {
  if (!userId) return emptyState();

  const disk = await readUiJson<Partial<AccountsUiState>>(
    userId,
    UI_FILES.accounts,
  );
  if (disk && typeof disk === "object") {
    const state = normalizeState(disk);
    writeLocal(userId, state);
    return state;
  }

  const local = readLocal(userId);
  if (local.expandedDomains.length > 0) {
    writeLocal(userId, local);
    await writeUiJson(userId, UI_FILES.accounts, local);
  }
  return local;
}
