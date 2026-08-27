import type { AppSessionDeps } from "./types";

/** Lazy-load the desktop bridge so the store stays importable in the
 * unit-test runner (no `@/` alias, no Tauri). Production injects nothing
 * and these load on first use. */
async function bridge() {
  return await import("../desktop/bridge");
}

export function defaultIsDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  return Boolean(w.__TAURI_INTERNALS__);
}

export function createDefaultDeps(
  overrides?: Partial<AppSessionDeps>,
): AppSessionDeps {
  return {
    isDesktop: defaultIsDesktop,
    authenticateBiometry: (reason) =>
      import("../biometry/plugin").then((b) =>
        b.desktopAuthenticateBiometry(reason),
      ),
    ownerSessionStatus: () =>
      bridge().then((b) => b.desktopOwnerSessionStatus()),
    ownerLogin: (input) => bridge().then((b) => b.desktopOwnerLogin(input)),
    ownerUnlock: () => bridge().then((b) => b.desktopOwnerUnlock()),
    ownerLogout: () => bridge().then((b) => b.desktopOwnerLogout()),
    ownerSetupAdmin: (input) =>
      bridge().then((b) => b.desktopOwnerSetupAdmin(input)),
    ownerResetAdmin: (input) =>
      bridge().then((b) => b.desktopOwnerResetAdmin(input)),
    teamSessionStatus: () => bridge().then((b) => b.desktopTeamSessionStatus()),
    teamLogin: (input) => bridge().then((b) => b.desktopTeamLogin(input)),
    teamUnlock: () => bridge().then((b) => b.desktopTeamUnlock()),
    teamLogout: () => bridge().then((b) => b.desktopTeamLogout()),
    teamSetBiometryEnabled: (enabled) =>
      bridge().then((b) => b.desktopTeamSetBiometryEnabled(enabled)),
    ...overrides,
  };
}
