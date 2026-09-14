import { isDesktopRuntime } from "@/lib/desktop/bridge";
import type { AppSessionStore } from "@/lib/desktop/app-session";

import { ownerLogout } from "./owner-session";
import { clearWebOwnerSessionStorage } from "./web-owner-persist";

/** Where to land after sign-out: unlock when a keyring session remains, else setup/login. */
export function signOutRedirectPath(
  isTeam: boolean,
  store: AppSessionStore,
): string {
  if (!isDesktopRuntime()) {
    return "/login";
  }
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
  if (!isDesktopRuntime()) {
    // Web: revoke owner refresh (needs the Worker URL global, so before the
    // team clear below deletes it), then drop owner + team tab storage.
    await ownerLogout();
    clearWebOwnerSessionStorage();
    const { setWebTeamAuth } = await import("@/mail-platform/session/email-session");
    setWebTeamAuth(null);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("relaybase:email-session");
      } catch {
        /* ignore */
      }
    }
    return;
  }
  await store.signOut();
}
