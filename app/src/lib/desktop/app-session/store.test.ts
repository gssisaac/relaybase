import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  OwnerSessionStatus,
  TeamSessionStatus,
} from "../bridge/index.ts";
import { AppSessionStore } from "./store.ts";

function ownerStatus(partial: Partial<OwnerSessionStatus>): OwnerSessionStatus {
  return {
    hasRefresh: false,
    hasAccess: false,
    username: "",
    workerUrl: "",
    biometryEnabled: true,
    platform: "macos",
    ...partial,
  };
}

function teamStatus(partial: Partial<TeamSessionStatus>): TeamSessionStatus {
  return {
    hasSecret: false,
    hasAccess: false,
    accountEmail: "",
    workerUrl: "",
    biometryEnabled: true,
    platform: "macos",
    ...partial,
  };
}

async function waitUntil(
  pred: () => boolean,
  label: string,
): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    if (pred()) return;
    await Promise.resolve();
  }
  throw new Error(label);
}

const WORKER_URL = "https://relaybase-api.example.workers.dev";

const SAMPLE_CREDENTIALS = {
  accountId: "",
  installToken: "",
  workerUrl: WORKER_URL,
  adminToken: "",
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
    ownerUnlock?: () => Promise<OwnerSessionStatus>;
    teamUnlock?: () => Promise<TeamSessionStatus>;
    ownerLogin?: (input: {
      workerUrl: string;
      username: string;
      passtoken: string;
    }) => Promise<OwnerSessionStatus>;
    teamLogin?: (input: {
      workerUrl: string;
      accountEmail: string;
      mobilePassword: string;
    }) => Promise<TeamSessionStatus>;
    ownerSetBiometryEnabled?: (enabled: boolean) => Promise<OwnerSessionStatus>;
    ownerLogout?: () => Promise<void>;
    ownerSessionStatus?: () => Promise<OwnerSessionStatus>;
    teamSetBiometryEnabled?: (enabled: boolean) => Promise<TeamSessionStatus>;
    teamLogout?: () => Promise<void>;
    teamForgetSession?: () => Promise<TeamSessionStatus>;
    teamSessionStatus?: () => Promise<TeamSessionStatus>;
    isDesktop?: () => boolean;
    refreshIdentity?: () => Promise<void>;
    clearOwnerDisk?: () => Promise<void>;
    clearTeamDisk?: () => Promise<void>;
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
    ownerLogin: overrides.ownerLogin ??
      (() => Promise.resolve(ownerStatus({ hasAccess: true }))),
    ownerUnlock: overrides.ownerUnlock ??
      (() => Promise.resolve(ownerStatus({ hasAccess: true }))),
    ownerLogout: overrides.ownerLogout ?? (() => Promise.resolve()),
    ownerSetupAdmin: () => Promise.resolve({ username: "owner", passtoken: "p" }),
    ownerResetAdmin: () => Promise.resolve({ username: "owner", passtoken: "p" }),
    ownerSetBiometryEnabled: overrides.ownerSetBiometryEnabled ??
      ((enabled: boolean) =>
        Promise.resolve(
          ownerStatus({ hasRefresh: true, hasAccess: true, biometryEnabled: enabled }),
        )),
    teamSessionStatus:
      overrides.teamSessionStatus ??
      (() => Promise.resolve(overrides.teamStatus ?? teamStatus({}))),
    teamLogin: overrides.teamLogin ??
      (() => Promise.resolve(teamStatus({ hasAccess: true }))),
    teamUnlock: overrides.teamUnlock ??
      (() => Promise.resolve(teamStatus({ hasAccess: true }))),
    teamLogout: overrides.teamLogout ?? (() => Promise.resolve()),
    teamForgetSession:
      overrides.teamForgetSession ?? (() => Promise.resolve(teamStatus({}))),
    teamSetBiometryEnabled: overrides.teamSetBiometryEnabled ??
      ((enabled: boolean) =>
        Promise.resolve(teamStatus({ hasAccess: true, biometryEnabled: enabled }))),
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
  };
}

function createStore(
  overrides: Parameters<typeof makeDeps>[0] = {},
): AppSessionStore {
  const storeRef: { current: AppSessionStore | null } = { current: null };
  const store = new AppSessionStore(makeDeps(overrides, storeRef));
  storeRef.current = store;
  return store;
}

describe("AppSessionStore", () => {
  it("boots to ownerReady when the owner already has access", () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasAccess: true }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({ hasAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
  });

  it("boots to unlock prompting and fires Touch ID when owner has refresh", async () => {
    let prompted = 0;
    let unlocked = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasRefresh: true }),
      authenticateBiometry: () => {
        prompted += 1;
        return Promise.resolve();
      },
      ownerUnlock: () => {
        unlocked += 1;
        return Promise.resolve(ownerStatus({ hasAccess: true }));
      },
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    assert.equal(store.phase.kind, "unlock");
    assert.equal(store.needsUnlockPrompt, true);
    await waitUntil(() => store.phase.kind === "ownerReady", "owner did not unlock");
    assert.equal(prompted, 1);
    assert.equal(unlocked, 1);
  });

  it("lands on passtoken form when owner has workerUrl but no keyring", () => {
    const store = createStore({ ownerStatus: ownerStatus({}) });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: {
        accountId: "",
        installToken: "",
        workerUrl: "https://relaybase-api.example.workers.dev",
        adminToken: "",
        workerScriptName: "",
        workerVersion: "",
        relaybaseAccountId: "",
        relaybaseEmail: "",
        relaybaseSession: "",
        cfOauthAccessToken: "",
        cfOauthRefreshToken: "",
        cfOauthAccessExpiresAt: "",
        cfOauthAccountId: "",
      },
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("shows UnlockView from workerUrl before keyring status arrives", () => {
    const store = createStore({});
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: {
        accountId: "",
        installToken: "",
        workerUrl: "https://relaybase-api.example.workers.dev",
        adminToken: "",
        workerScriptName: "",
        workerVersion: "",
        relaybaseAccountId: "",
        relaybaseEmail: "",
        relaybaseSession: "",
        cfOauthAccessToken: "",
        cfOauthRefreshToken: "",
        cfOauthAccessExpiresAt: "",
        cfOauthAccountId: "",
      },
      teamIdentity: null,
    });
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
    }
  });

  it("requestPrompt stays on passtoken form without a keyring secret", () => {
    const store = createStore({});
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: {
        accountId: "",
        installToken: "",
        workerUrl: "https://relaybase-api.example.workers.dev",
        adminToken: "",
        workerScriptName: "",
        workerVersion: "",
        relaybaseAccountId: "",
        relaybaseEmail: "",
        relaybaseSession: "",
        cfOauthAccessToken: "",
        cfOauthRefreshToken: "",
        cfOauthAccessExpiresAt: "",
        cfOauthAccountId: "",
      },
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    store.showSecretForm();
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
    }
    store.requestPrompt();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
    }
  });

  it("leaveRecover returns to passtoken form without keyring", () => {
    const store = createStore({});
    store.enterRecover();
    assert.equal(store.phase.kind, "ownerRecover");
    store.leaveRecover();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("lands on choice when nothing is enrolled", () => {
    const store = createStore({});
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "choice");
  });

  it("invited with a keyring secret unlocks via Touch ID", async () => {
    let prompted = 0;
    let unlocked = 0;
    const store = createStore({
      teamStatus: teamStatus({ hasSecret: true }),
      authenticateBiometry: () => {
        prompted += 1;
        return Promise.resolve();
      },
      teamUnlock: () => {
        unlocked += 1;
        return Promise.resolve(teamStatus({ hasAccess: true }));
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: {
            workerUrl: WORKER_URL,
            accountEmail: "teammate@example.com",
            mobilePassword: "",
          },
        });
      },
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: {
        workerUrl: "https://relaybase-api.example.workers.dev",
        accountEmail: "teammate@example.com",
        mobilePassword: "",
      },
    });
    store.setStatuses(
      ownerStatus({}),
      teamStatus({ hasSecret: true }),
    );
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") assert.equal(store.phase.role, "invited");
    await waitUntil(
      () => store.phase.kind === "invitedReady",
      "invited did not unlock",
    );
    assert.equal(prompted, 1);
    assert.equal(unlocked, 1);
  });

  it("first owner passtoken login offers biometry, then accept enters the app", async () => {
    let enableCalls = 0;
    const store = createStore({
      ownerLogin: () =>
        Promise.resolve(
          ownerStatus({
            hasRefresh: true,
            hasAccess: true,
            biometryEnabled: false,
            platform: "macos",
            workerUrl: WORKER_URL,
          }),
        ),
      ownerSetBiometryEnabled: (enabled: boolean) => {
        enableCalls += 1;
        assert.equal(enabled, true);
        return Promise.resolve(
          ownerStatus({
            hasRefresh: true,
            hasAccess: true,
            biometryEnabled: true,
            workerUrl: WORKER_URL,
          }),
        );
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: { ...SAMPLE_CREDENTIALS },
          teamIdentity: null,
        });
      },
    });
    await store.loginWithPasstoken({
      workerUrl: WORKER_URL,
      username: "isaac",
      passtoken: "rb_pass_abc123XYZ-________",
    });
    assert.equal(store.phase.kind, "offerBiometry");
    if (store.phase.kind === "offerBiometry") {
      assert.equal(store.phase.role, "owner");
    }
    await store.acceptBiometry();
    assert.equal(enableCalls, 1);
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("owner decline biometry enters app and skips auto Touch ID on next launch", async () => {
    let enableCalls = 0;
    const store = createStore({
      ownerLogin: () =>
        Promise.resolve(
          ownerStatus({
            hasRefresh: true,
            hasAccess: true,
            biometryEnabled: false,
            platform: "macos",
            workerUrl: WORKER_URL,
          }),
        ),
      ownerSetBiometryEnabled: (enabled: boolean) => {
        enableCalls += 1;
        assert.equal(enabled, false);
        return Promise.resolve(
          ownerStatus({
            hasRefresh: true,
            hasAccess: true,
            biometryEnabled: false,
            workerUrl: WORKER_URL,
          }),
        );
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: { ...SAMPLE_CREDENTIALS },
          teamIdentity: null,
        });
      },
    });
    await store.loginWithPasstoken({
      workerUrl: WORKER_URL,
      username: "isaac",
      passtoken: "rb_pass_abc123XYZ-________",
    });
    await store.declineBiometry();
    assert.equal(enableCalls, 1);
    assert.equal(store.phase.kind, "ownerReady");
    store.setStatuses(
      ownerStatus({
        hasRefresh: true,
        biometryEnabled: false,
        workerUrl: WORKER_URL,
      }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
    }
  });

  it("boots to Touch ID idle when owner keyring exists but biometry is off", () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasRefresh: true,
        biometryEnabled: false,
        workerUrl: WORKER_URL,
      }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({
        hasRefresh: true,
        biometryEnabled: false,
        workerUrl: WORKER_URL,
      }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
    }
  });

  it("requestPrompt returns to Touch ID idle from passtoken when keyring exists without auto biometry", () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasRefresh: true,
        biometryEnabled: false,
        workerUrl: WORKER_URL,
      }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({
        hasRefresh: true,
        biometryEnabled: false,
        workerUrl: WORKER_URL,
      }),
      teamStatus({}),
    );
    store.showSecretForm();
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
    }
    store.requestPrompt();
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
    }
  });

  it("first invited login offers biometry, then accept enters the app", async () => {
    let enableCalls = 0;
    const store = createStore({
      teamLogin: () =>
        Promise.resolve(teamStatus({ hasAccess: true, platform: "macos" })),
      teamSetBiometryEnabled: (enabled: boolean) => {
        enableCalls += 1;
        assert.equal(enabled, true);
        return Promise.resolve(
          teamStatus({ hasAccess: true, biometryEnabled: true }),
        );
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: {
            workerUrl: WORKER_URL,
            accountEmail: "teammate@example.com",
            mobilePassword: "",
          },
        });
      },
    });
    await store.loginInvited({
      workerUrl: "https://relaybase-api.example.workers.dev",
      accountEmail: "teammate@example.com",
      mobilePassword: "pw",
    });
    assert.equal(store.phase.kind, "offerBiometry");
    await store.acceptBiometry();
    assert.equal(enableCalls, 1);
    assert.equal(store.phase.kind, "invitedReady");
  });

  it("decline still enters the app and disables biometry", async () => {
    let enableCalls = 0;
    const store = createStore({
      teamLogin: () =>
        Promise.resolve(teamStatus({ hasAccess: true, platform: "macos" })),
      teamSetBiometryEnabled: (enabled: boolean) => {
        enableCalls += 1;
        assert.equal(enabled, false);
        return Promise.resolve(
          teamStatus({ hasAccess: true, biometryEnabled: false }),
        );
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: {
            workerUrl: WORKER_URL,
            accountEmail: "teammate@example.com",
            mobilePassword: "",
          },
        });
      },
    });
    await store.loginInvited({
      workerUrl: "https://relaybase-api.example.workers.dev",
      accountEmail: "teammate@example.com",
      mobilePassword: "pw",
    });
    assert.equal(store.phase.kind, "offerBiometry");
    await store.declineBiometry();
    assert.equal(enableCalls, 1);
    assert.equal(store.phase.kind, "invitedReady");
  });

  it("does not consume the Touch ID one-shot before the desktop runtime exists", async () => {
    let prompted = 0;
    let desktop = false;
    const store = createStore({
      isDesktop: () => desktop,
      ownerStatus: ownerStatus({ hasRefresh: true }),
      authenticateBiometry: () => {
        prompted += 1;
        return Promise.resolve();
      },
      ownerUnlock: () => Promise.resolve(ownerStatus({ hasAccess: true })),
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await Promise.resolve();
    assert.equal(prompted, 0);
    assert.equal(store.phase.kind, "unlock");

    desktop = true;
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "late desktop did not unlock");
    assert.equal(prompted, 1);
  });

  it("retries Touch ID once after a launch systemCancel", async () => {
    let prompted = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasRefresh: true }),
      authenticateBiometry: () => {
        prompted += 1;
        if (prompted === 1) {
          return Promise.reject(
            new Error("[systemCancel] - Authentication canceled."),
          );
        }
        return Promise.resolve();
      },
      ownerUnlock: () => Promise.resolve(ownerStatus({ hasAccess: true })),
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(prompted, 2);
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("keeps ownerReady when a stale empty status arrives after unlock", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasRefresh: true }),
      ownerUnlock: () =>
        Promise.resolve(ownerStatus({ hasRefresh: true, hasAccess: true })),
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "did not unlock");
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("opens passtoken form when unlock fails with no saved session", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasRefresh: true }),
      ownerUnlock: () =>
        Promise.reject(
          new Error("No saved session. Sign in with your username and passtoken."),
        ),
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await waitUntil(() => {
      if (store.busy || store.phase.kind !== "unlock") return false;
      return store.phase.mode === "secret";
    }, "unlock did not settle on passtoken form");
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
    }
    assert.equal(store.error, null);
  });

  it("a dismissed biometry prompt falls back to idle, not an error", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasRefresh: true }),
      authenticateBiometry: () => Promise.reject(new Error("userCancel")),
      ownerUnlock: () => Promise.resolve(ownerStatus({ hasAccess: true })),
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
    }
    assert.equal(store.error, null);
  });

  it("does not enter the mailbox without a connected Worker URL", () => {
    const store = createStore({ ownerStatus: ownerStatus({ hasAccess: true }) });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({ hasAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "choice");
    assert.equal(store.canShowApp, false);
  });

  it("enters the mailbox when owner access and Worker URL are both present", () => {
    const store = createStore({ ownerStatus: ownerStatus({ hasAccess: true }) });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: {
        accountId: "",
        installToken: "",
        workerUrl: "https://relaybase-api.example.workers.dev",
        adminToken: "",
        workerScriptName: "",
        workerVersion: "",
        relaybaseAccountId: "",
        relaybaseEmail: "",
        relaybaseSession: "",
        cfOauthAccessToken: "",
        cfOauthRefreshToken: "",
        cfOauthAccessExpiresAt: "",
        cfOauthAccountId: "",
      },
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({ hasAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
  });

  it("signOut locks to Touch ID idle when owner keyring exists without auto biometry", async () => {
    let cleared = 0;
    let loggedOut = 0;
    const statusAfterLock = ownerStatus({
      hasRefresh: true,
      biometryEnabled: false,
      workerUrl: WORKER_URL,
    });
    const store = createStore({
      ownerSessionStatus: () => Promise.resolve(statusAfterLock),
      ownerLogout: async () => {
        loggedOut += 1;
      },
      clearOwnerDisk: async () => {
        cleared += 1;
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: null,
        });
      },
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({
        hasAccess: true,
        hasRefresh: true,
        biometryEnabled: false,
      }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.signOut();
    assert.equal(loggedOut, 1);
    assert.equal(cleared, 1);
    assert.equal(store.ownerStatus?.hasRefresh, true);
    assert.equal(store.ownerStatus?.biometryEnabled, false);
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("signOut locks to Touch ID when owner keyring and biometry remain", async () => {
    let cleared = 0;
    let loggedOut = 0;
    let statusAfterLock = ownerStatus({
      hasRefresh: true,
      biometryEnabled: true,
      workerUrl: WORKER_URL,
    });
    const store = createStore({
      ownerSessionStatus: () => Promise.resolve(statusAfterLock),
      ownerLogout: async () => {
        loggedOut += 1;
      },
      clearOwnerDisk: async () => {
        cleared += 1;
      },
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: null,
        });
      },
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({ hasAccess: true, hasRefresh: true, biometryEnabled: true }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.signOut();
    assert.equal(loggedOut, 1);
    assert.equal(cleared, 1);
    assert.equal(store.ownerStatus?.hasRefresh, true);
    assert.equal(store.ownerStatus?.biometryEnabled, true);
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "prompting");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("signOut returns to welcome when no keyring session remains", async () => {
    let cleared = 0;
    let refreshed = 0;
    let statusAfterLock = ownerStatus({});
    const store = createStore({
      ownerSessionStatus: () => Promise.resolve(statusAfterLock),
      clearOwnerDisk: async () => {
        cleared += 1;
      },
      refreshIdentity: async () => {
        refreshed += 1;
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: null,
        });
      },
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({ hasAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
    await store.signOut();
    assert.equal(store.phase.kind, "choice");
    assert.equal(store.ownerStatus?.hasAccess, false);
    assert.equal(store.ownerStatus?.hasRefresh, false);
    assert.equal(cleared, 1);
    assert.equal(refreshed, 1);
  });

  it("openAlreadyInstalled enters passtoken form when nothing is on disk", () => {
    const store = createStore({});
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "choice");
    store.openAlreadyInstalled();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
      assert.equal(store.phase.mode, "secret");
    }
  });

  it("openAlreadyInstalled stays on passtoken form after reconcile with no disk URL", () => {
    const store = createStore({});
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    store.openAlreadyInstalled();
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
    }
  });

  it("openAlreadyInstalled prompts Touch ID when the owner keyring has a refresh", async () => {
    let prompted = 0;
    const store = createStore({
      authenticateBiometry: () => {
        prompted += 1;
        return Promise.resolve();
      },
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    store.openAlreadyInstalled();
    assert.equal(store.phase.kind, "unlock");
    await waitUntil(() => prompted > 0, "Touch ID did not prompt");
    assert.equal(prompted, 1);
  });

  it("awaits refreshIdentity before ownerReady after unlock", async () => {
    let refreshCalls = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasRefresh: true }),
      ownerUnlock: () => Promise.resolve(ownerStatus({ hasAccess: true })),
      refreshIdentity: async () => {
        refreshCalls += 1;
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: SAMPLE_CREDENTIALS,
          teamIdentity: null,
        });
      },
    });
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "did not unlock");
    assert.equal(refreshCalls, 1);
    assert.equal(store.canShowApp, true);
  });

  it("keeps ownerReady when credentials are cleared but keyring has workerUrl", () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasAccess: true, workerUrl: WORKER_URL }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({ hasAccess: true, workerUrl: WORKER_URL }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
  });

  it("downgrades ownerReady to choice when credentials and keyring URL are gone", () => {
    const store = createStore({ ownerStatus: ownerStatus({ hasAccess: true }) });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({ hasAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    assert.equal(store.phase.kind, "choice");
    assert.equal(store.canShowApp, false);
  });

  it("canShowApp is true when only keyring workerUrl exists", () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasAccess: true,
        workerUrl: WORKER_URL,
      }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({ hasAccess: true, workerUrl: WORKER_URL }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
  });

  it("lands on passtoken form from keyring workerUrl without credentials.json", () => {
    const store = createStore({ ownerStatus: ownerStatus({}) });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({ workerUrl: WORKER_URL }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("openAlreadyInstalled uses passtoken form when keyring has workerUrl only", () => {
    const store = createStore({
      ownerStatus: ownerStatus({ workerUrl: WORKER_URL }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(
      ownerStatus({ workerUrl: WORKER_URL }),
      teamStatus({}),
    );
    store.openAlreadyInstalled();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "secret");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("openInvitedLogin stays on invitedLogin after reconcile with no disk URL", () => {
    const store = createStore({});
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "choice");
    store.openInvitedLogin();
    assert.equal(store.phase.kind, "invitedLogin");
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "invitedLogin");
  });

  it("loginInvited offerBiometry survives late hydrate", async () => {
    const store = createStore({
      teamLogin: () =>
        Promise.resolve(
          teamStatus({
            hasAccess: true,
            hasSecret: true,
            workerUrl: WORKER_URL,
            accountEmail: "teammate@example.com",
            platform: "macos",
          }),
        ),
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: null,
          teamIdentity: {
            workerUrl: WORKER_URL,
            accountEmail: "teammate@example.com",
            mobilePassword: "",
          },
        });
      },
    });
    await store.loginInvited({
      workerUrl: WORKER_URL,
      accountEmail: "teammate@example.com",
      mobilePassword: "pw",
    });
    assert.equal(store.phase.kind, "offerBiometry");
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: {
        workerUrl: WORKER_URL,
        accountEmail: "teammate@example.com",
        mobilePassword: "",
      },
    });
    store.setStatuses(
      ownerStatus({}),
      teamStatus({
        hasSecret: true,
        hasAccess: true,
        workerUrl: WORKER_URL,
        accountEmail: "teammate@example.com",
      }),
    );
    assert.equal(store.phase.kind, "offerBiometry");
  });

  it("switchToOwnerLogin forgets team session and enters owner unlock", async () => {
    let forgot = 0;
    const store = createStore({
      teamForgetSession: () => {
        forgot += 1;
        return Promise.resolve(teamStatus({}));
      },
      ownerSessionStatus: () =>
        Promise.resolve(ownerStatus({ hasRefresh: true })),
      refreshIdentity: async () => {
        store.setIdentity({
          ready: true,
          isDesktop: true,
          credentials: SAMPLE_CREDENTIALS,
          teamIdentity: null,
        });
      },
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: {
        workerUrl: WORKER_URL,
        accountEmail: "teammate@example.com",
        mobilePassword: "",
      },
    });
    store.setStatuses(
      ownerStatus({ hasRefresh: true }),
      teamStatus({ hasSecret: true }),
    );
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "invited");
    }
    await store.switchToOwnerLogin();
    assert.equal(forgot, 1);
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
    }
  });
});
