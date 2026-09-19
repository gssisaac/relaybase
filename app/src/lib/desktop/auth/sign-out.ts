import { isDesktopRuntime } from "@/lib/desktop/bridge";
import type { AppSessionStore } from "@/lib/desktop/app-session";
import { hasHqSession } from "@/lib/hq-auth/session";
import { hasOwnerSession } from "./owner-session";

/** Web: cloud account and/or server-minted Worker owner session. */
export function hasWebWorkerSession(_isTeam: boolean): boolean {
  if (isDesktopRuntime()) return false;
  return hasHqSession() && hasOwnerSession();
}

/** Web: revoke cloud cookie, access JWT, and Worker owner tokens. */
export async function signOutHqStudio(): Promise<void> {
  const { cloudLogout } = await import("@/lib/auth/cloud-session");
  await cloudLogout();
}

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
    await signOutHqStudio();
    return;
  }
  await store.signOut();
}
