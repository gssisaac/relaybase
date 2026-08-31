import type { AppSessionDeps } from "./types";

async function bridge() {
  return await import("../bridge");
}

export function defaultIsDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI__?: { core?: { invoke?: unknown } };
  };
  return Boolean(w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.core?.invoke);
}

export function createDefaultDeps(
  overrides?: Partial<AppSessionDeps>,
): AppSessionDeps {
  return {
    isDesktop: defaultIsDesktop,
    authenticateBiometry: (reason) =>
      bridge().then((b) => b.desktopOwnerTouchId(reason)),
    ownerSessionStatus: () =>
      bridge().then((b) => b.desktopOwnerSessionStatus()),
    ownerLogin: (input) => bridge().then((b) => b.desktopOwnerLogin(input)),
    ownerBootMail: () => bridge().then((b) => b.desktopOwnerBootMail()),
    ownerUnlockConsole: () =>
      bridge().then((b) => b.desktopOwnerUnlockConsole()),
    ownerLoginFromKeyring: (reason, workerUrl) =>
      bridge().then((b) => b.desktopOwnerLoginFromKeyring(reason, workerUrl)),
    ownerLogout: () => bridge().then((b) => b.desktopOwnerLogout()),
    ownerSetupAdmin: (input) =>
      bridge().then((b) => b.desktopOwnerSetupAdmin(input)),
    ownerResetAdmin: (input) =>
      bridge().then((b) => b.desktopOwnerResetAdmin(input)),
    teamSessionStatus: () => bridge().then((b) => b.desktopTeamSessionStatus()),
    teamLogin: (input) => bridge().then((b) => b.desktopTeamLogin(input)),
    teamUnlock: () => bridge().then((b) => b.desktopTeamUnlock()),
    teamLogout: () => bridge().then((b) => b.desktopTeamLogout()),
    teamForgetSession: () =>
      bridge().then((b) => b.desktopTeamForgetSession()),
    fetchWorkerPasstokenPrefix: (workerUrl) =>
      bridge().then(async (b) => {
        const status = await b.desktopOwnerAuthStatus(workerUrl);
        return status.passtokenPrefix;
      }),
    refreshIdentity: overrides?.refreshIdentity ?? (() => Promise.resolve()),
    clearOwnerDisk: () =>
      bridge().then((b) =>
        Promise.all([
          b.desktopClearCredentials(),
          b.desktopClearRelaybaseAccount(),
        ]).then(() => undefined),
      ),
    clearTeamDisk: () =>
      bridge().then((b) => b.desktopClearTeamLogin()),
    ...overrides,
  };
}
