import type {
  OwnerSessionStatus,
  TeamSessionStatus,
} from "../../bridge/index.ts";
import { AppSessionStore } from "../store.ts";

export function ownerStatus(
  partial: Partial<OwnerSessionStatus>,
): OwnerSessionStatus {
  return {
    hasMailRefresh: false,
    hasConsoleRefresh: false,
    hasMailAccess: false,
    hasConsoleAccess: false,
    hasRefresh: false,
    hasAccess: false,
    hasPasstoken: false,
    keyringPasstokenPrefix: "",
    workerUrl: "",
    knownWorkerUrls: [],
    platform: "macos",
    ...partial,
  };
}

export function teamStatus(
  partial: Partial<TeamSessionStatus>,
): TeamSessionStatus {
  return {
    hasSecret: false,
    hasAccess: false,
    accountEmail: "",
    workerUrl: "",
    platform: "macos",
    ...partial,
  };
}

export async function waitUntil(
  pred: () => boolean,
  label: string,
): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    if (pred()) return;
    await Promise.resolve();
  }
  throw new Error(label);
}

export const WORKER_URL = "https://relaybase-api.example.workers.dev";

export const SAMPLE_CREDENTIALS = {
  accountId: "",
  installToken: "",
  workerUrl: WORKER_URL,
  workerScriptName: "",
  workerVersion: "",
  relaybaseAccountId: "",
  relaybaseEmail: "",
  relaybaseSession: "",
  cfOauthAccessToken: "",
  cfOauthRefreshToken: "",
  cfOauthAccessExpiresAt: "",
  cfOauthAccountId: "",
};

function makeDeps(
  overrides: {
    ownerStatus?: OwnerSessionStatus;
    teamStatus?: TeamSessionStatus;
    authenticateBiometry?: () => Promise<void>;
    ownerBootMail?: () => Promise<OwnerSessionStatus>;
    ownerUnlockConsole?: () => Promise<OwnerSessionStatus>;
    ownerLoginFromKeyring?: (
      reason: string,
      workerUrl?: string,
    ) => Promise<OwnerSessionStatus>;
    ownerLogin?: (input: {
      workerUrl: string;
      passtoken: string;
    }) => Promise<OwnerSessionStatus>;
    teamLogin?: (input: {
      workerUrl: string;
      accountEmail: string;
      mobilePassword: string;
    }) => Promise<TeamSessionStatus>;
    teamUnlock?: () => Promise<TeamSessionStatus>;
    ownerLogout?: () => Promise<void>;
    ownerSessionStatus?: (
      workerUrl?: string,
    ) => Promise<OwnerSessionStatus>;
    teamLogout?: () => Promise<void>;
    teamForgetSession?: () => Promise<TeamSessionStatus>;
    teamSessionStatus?: () => Promise<TeamSessionStatus>;
    fetchWorkerPasstokenPrefix?: (workerUrl: string) => Promise<string | null>;
    isDesktop?: () => boolean;
    refreshIdentity?: () => Promise<void>;
    clearOwnerDisk?: () => Promise<void>;
    clearTeamDisk?: () => Promise<void>;
    factoryReset?: () => Promise<string>;
    clearDashboardClientCache?: () => void;
  },
  storeRef?: { current: AppSessionStore | null },
) {
  return {
    isDesktop: overrides.isDesktop ?? (() => true),
    authenticateBiometry:
      overrides.authenticateBiometry ?? (() => Promise.resolve()),
    ownerSessionStatus:
      overrides.ownerSessionStatus ??
      (() => Promise.resolve(overrides.ownerStatus ?? ownerStatus({}))),
    ownerLogin:
      overrides.ownerLogin ??
      (() => Promise.resolve(ownerStatus({ hasMailAccess: true }))),
    ownerBootMail:
      overrides.ownerBootMail ??
      (() => Promise.resolve(ownerStatus({ hasMailAccess: true }))),
    ownerUnlockConsole:
      overrides.ownerUnlockConsole ??
      (() => Promise.resolve(ownerStatus({ hasConsoleAccess: true }))),
    ownerLoginFromKeyring:
      overrides.ownerLoginFromKeyring ??
      (() =>
        Promise.resolve(
          ownerStatus({ hasMailAccess: true, hasPasstoken: true }),
        )),
    ownerLogout: overrides.ownerLogout ?? (() => Promise.resolve()),
    ownerSetupAdmin: () => Promise.resolve({ passtoken: "p" }),
    ownerResetAdmin: () => Promise.resolve({ passtoken: "p" }),
    teamSessionStatus:
      overrides.teamSessionStatus ??
      (() => Promise.resolve(overrides.teamStatus ?? teamStatus({}))),
    teamLogin:
      overrides.teamLogin ??
      (() => Promise.resolve(teamStatus({ hasAccess: true }))),
    teamUnlock:
      overrides.teamUnlock ??
      (() => Promise.resolve(teamStatus({ hasAccess: true }))),
    teamLogout: overrides.teamLogout ?? (() => Promise.resolve()),
    teamForgetSession:
      overrides.teamForgetSession ?? (() => Promise.resolve(teamStatus({}))),
    fetchWorkerPasstokenPrefix:
      overrides.fetchWorkerPasstokenPrefix ?? (() => Promise.resolve(null)),
    refreshIdentity:
      overrides.refreshIdentity ??
      (async () => {
        storeRef?.current?.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: SAMPLE_CREDENTIALS,
          teamIdentity: null,
        });
      }),
    clearOwnerDisk: overrides.clearOwnerDisk ?? (() => Promise.resolve()),
    clearTeamDisk: overrides.clearTeamDisk ?? (() => Promise.resolve()),
    factoryReset: overrides.factoryReset ?? (() => Promise.resolve("")),
    clearDashboardClientCache:
      overrides.clearDashboardClientCache ?? (() => {}),
  };
}

export function createStore(
  overrides: Parameters<typeof makeDeps>[0] = {},
): AppSessionStore {
  const storeRef: { current: AppSessionStore | null } = { current: null };
  const store = new AppSessionStore(makeDeps(overrides, storeRef));
  storeRef.current = store;
  return store;
}

export function connectOwner(store: AppSessionStore): void {
  store.setIdentity({
    ready: true,
    isDesktop: true,
    credentials: SAMPLE_CREDENTIALS,
    teamIdentity: null,
  });
}
