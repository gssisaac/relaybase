import type {
  DesktopCredentials,
  DesktopTeamLogin,
} from "@/lib/desktop/bridge";

/** Survives layout remounts after packaged static navigations. */
export type DesktopSessionSnapshot = {
  isDesktop: boolean;
  ready: boolean;
  credentials: DesktopCredentials | null;
  teamLogin: DesktopTeamLogin | null;
};

let cachedSession: DesktopSessionSnapshot | null = null;

export function readDesktopSessionCache(): DesktopSessionSnapshot | null {
  return cachedSession;
}

export function writeDesktopSessionCache(
  snapshot: DesktopSessionSnapshot,
): void {
  cachedSession = snapshot;
}

export function clearDesktopSessionCache(): void {
  cachedSession = null;
}

/**
 * Clear all scope-dependent localStorage mirrors so stale data from a
 * previous CF / Relaybase account does not bleed into the new scope.
 *
 * Disk is the source of truth and is now scoped by Rust
 * (`~/.relaybase/{scopeId}/…`), so clearing the localStorage fallback is
 * safe — disk reads on the new scope return null, and the stores
 * re-bootstrap from the network.
 *
 * Key prefixes cleared:
 * - `relaybase:mail:v1:` (mail lists, details, UI state, broadcast drafts)
 * - `relaybase:cache:v1:` (dashboard envelope cache)
 * - `products-v1:` (dashboard TTL client cache)
 * - `relaybase:email.json` (email prefs)
 * - `relaybase:api-keys-vault:v1` (API key vault)
 */
const SCOPE_DEPENDENT_LOCAL_STORAGE_PREFIXES = [
  "relaybase:mail:v1:",
  "relaybase:cache:v1:",
  "relaybase:compose-contacts:",
  "relaybase:mail-accounts:",
  "products-v1:",
  "relaybase:email.json",
  "relaybase:api-keys-vault:v1",
];

export function clearScopeDependentLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        SCOPE_DEPENDENT_LOCAL_STORAGE_PREFIXES.some((prefix) =>
          key.startsWith(prefix),
        )
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    /* private mode / quota — ignore */
  }
}
