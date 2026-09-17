import { isDesktopRuntime } from "@/lib/desktop/bridge";
import type { AppSessionStore } from "@/lib/desktop/app-session";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

import { ownerLogout } from "./owner-session";
import { clearWebOwnerSessionStorage } from "./web-owner-persist";

/** Web Worker (mailbox / console) session — independent of HQ Studio login. */
export function hasWebWorkerSession(isTeam: boolean): boolean {
  if (isDesktopRuntime()) return false;
  if (isTeam) return Boolean(getWebTeamAuth());
  return hasWebOwnerSession();
}

/** Web: revoke HQ Studio refresh cookie + in-memory JWT only. */
export async function signOutHqStudio(): Promise<void> {
  const { hqLogout } = await import("@/lib/hq-auth/session");
  await hqLogout();
}

/** Where to land after sign-out: unlock when a keyring session remains, else setup/login. */
export function signOutRedirectPath(
  isTeam: boolean,
  store: AppSessionStore,
): string {
  if (!isDesktopRuntime()) {
    return "/studio/login";
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
    await signOutHqStudio();
    // Revoke owner refresh (needs the Worker URL global, so before the
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
