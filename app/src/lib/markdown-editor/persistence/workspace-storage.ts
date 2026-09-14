/** Scoped localStorage for CRM editor drafts / outbox (Railmark workspace-storage subset). */

const SCOPE = "relaybase-crm";

export function getWorkspaceStorageScope(): string {
  return SCOPE;
}

export function canonicalWorkspacePath(workspacePath?: string | null): string | null {
  const raw = (workspacePath ?? SCOPE).trim();
  return raw || SCOPE;
}

export function readScopedItem(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(`${SCOPE}:${key}`);
  } catch {
    return null;
  }
}

export function writeScopedItem(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${SCOPE}:${key}`, value);
  } catch {
    /* quota */
  }
}

export function removeScopedItem(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${SCOPE}:${key}`);
  } catch {
    /* ignore */
  }
}
