import type { AppSessionStore } from "@/lib/desktop/app-session";

/** Where to land after sign-out: unlock when a keyring session remains, else setup/login. */
export function signOutRedirectPath(
  isTeam: boolean,
  store: AppSessionStore,
): string {
  if (isTeam) {
    return store.teamStatus?.hasSecret ? "/" : "/login";
  }
  return store.ownerStatus?.hasRefresh ? "/" : "/setup";
}

/** Sign out (lock): clear in-memory access, keep keyring for daily unlock. */
export async function signOutRelaybase(
  _isTeam: boolean,
  store: AppSessionStore,
): Promise<void> {
  await store.signOut();
}
