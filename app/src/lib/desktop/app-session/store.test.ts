import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  OwnerSessionStatus,
  TeamSessionStatus,
} from "../bridge/index.ts";
import { AppSessionStore } from "./store.ts";

function ownerStatus(partial: Partial<OwnerSessionStatus>): OwnerSessionStatus {
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
    ownerSessionStatus?: () => Promise<OwnerSessionStatus>;
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
      (() => Promise.resolve(ownerStatus({ hasMailAccess: true, hasPasstoken: true }))),
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

function createStore(
  overrides: Parameters<typeof makeDeps>[0] = {},
): AppSessionStore {
  const storeRef: { current: AppSessionStore | null } = { current: null };
  const store = new AppSessionStore(makeDeps(overrides, storeRef));
  storeRef.current = store;
  return store;
}

function connectOwner(store: AppSessionStore): void {
  store.setIdentity({
    ready: true,
    isDesktop: true,
    credentials: SAMPLE_CREDENTIALS,
    teamIdentity: null,
  });
}

describe("AppSessionStore", () => {
  it("boots to ownerReady when the owner already has mail access", () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true }),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
  });

  it("stays on boot when identity is ready before keyring status", () => {
    const store = createStore({});
    connectOwner(store);
    assert.equal(store.phase.kind, "boot");
  });

  it("routes to choice phase and skips silent boot when disk has no credentials even if keyring has tokens", async () => {
    let booted = 0;
    const store = createStore({
      ownerBootMail: () => {
        booted += 1;
        return Promise.resolve(
          ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
        );
      },
    });
    // Disk has no credentials (~/.relaybase was deleted)
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    // Keyring has leftover tokens
    store.setStatuses(
      ownerStatus({
        hasMailRefresh: true,
        hasPasstoken: true,
        workerUrl: "https://keyring.example.com",
      }),
      teamStatus({
        hasSecret: true,
        workerUrl: "https://keyring.example.com",
      }),
    );
    assert.equal(store.phase.kind, "choice");
    assert.equal(booted, 0);
  });

  it("silently boot-mails when owner has mail refresh but no access", async () => {
    let booted = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailRefresh: true }),
      ownerBootMail: () => {
        booted += 1;
        return Promise.resolve(
          ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "mail boot");
    assert.equal(booted, 1);
  });

  it("holds boot while owner silent mail unlock is in flight", async () => {
    let release!: (status: OwnerSessionStatus) => void;
    const pending = new Promise<OwnerSessionStatus>((resolve) => {
      release = resolve;
    });
    const store = createStore({
      ownerBootMail: () => pending,
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailRefresh: true }), teamStatus({}));
    assert.equal(store.phase.kind, "boot");
    release(ownerStatus({ hasMailRefresh: true, hasMailAccess: true }));
    await waitUntil(() => store.phase.kind === "ownerReady", "mail boot settle");
  });

  it("holds boot while invited silent unlock is in flight", async () => {
    let release!: (status: TeamSessionStatus) => void;
    const pending = new Promise<TeamSessionStatus>((resolve) => {
      release = resolve;
    });
    const store = createStore({
      teamUnlock: () => pending,
      refreshIdentity: async () => {
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
    store.setStatuses(ownerStatus({}), teamStatus({ hasSecret: true }));
    assert.equal(store.phase.kind, "boot");
    release(teamStatus({ hasSecret: true, hasAccess: true }));
    await waitUntil(
      () => store.phase.kind === "invitedReady",
      "team unlock settle",
    );
  });

  it("does not prompt Touch ID on mail boot", async () => {
    let prompted = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailRefresh: true }),
      authenticateBiometry: () => {
        prompted += 1;
        return Promise.resolve();
      },
      ownerBootMail: () =>
        Promise.resolve(
          ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
        ),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "mail boot");
    assert.equal(prompted, 0);
  });

  it("silently team-unlocks when invited has keyring secret", async () => {
    let unlocked = 0;
    const store = createStore({
      teamStatus: teamStatus({ hasSecret: true }),
      teamUnlock: () => {
        unlocked += 1;
        return Promise.resolve(teamStatus({ hasSecret: true, hasAccess: true }));
      },
      refreshIdentity: async () => {
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
    store.setStatuses(ownerStatus({}), teamStatus({ hasSecret: true }));
    await waitUntil(() => store.phase.kind === "invitedReady", "team unlock");
    assert.equal(unlocked, 1);
  });

  it("enters the mailbox when owner mail boot is unreachable", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailRefresh: true, workerUrl: WORKER_URL }),
      ownerBootMail: () =>
        Promise.reject(
          new Error("Worker request failed: error sending request"),
        ),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailRefresh: true, workerUrl: WORKER_URL }),
      teamStatus({}),
    );
    await waitUntil(() => store.phase.kind === "ownerReady", "offline mail");
    assert.equal(store.canShowApp, true);
    assert.equal(store.workerUnreachable, true);
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("enters the mailbox when invited unlock is unreachable", async () => {
    const store = createStore({
      teamUnlock: () =>
        Promise.reject(
          new Error("Worker request failed: error sending request"),
        ),
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
      ownerStatus({}),
      teamStatus({ hasSecret: true, workerUrl: WORKER_URL }),
    );
    await waitUntil(() => store.phase.kind === "invitedReady", "offline team");
    assert.equal(store.canShowApp, true);
    assert.equal(store.workerUnreachable, true);
    assert.equal(store.phase.kind, "invitedReady");
  });

  it("opens the typed form when mail refresh is expired, not offline", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailRefresh: true }),
      ownerBootMail: () =>
        Promise.reject(
          new Error("Session expired. Sign in with your passtoken."),
        ),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "unlock", "expired refresh");
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
    }
    assert.equal(store.workerUnreachable, false);
    assert.equal(store.canShowApp, false);
  });

  it("opens the typed form when Touch ID is dismissed on keyring boot", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasPasstoken: true }),
      ownerLoginFromKeyring: () =>
        Promise.reject(
          new Error("[UserCancel] - The user cancelled the authentication"),
        ),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasPasstoken: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "unlock", "bio dismiss");
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
    }
    assert.equal(store.workerUnreachable, false);
  });

  it("boots via keyring passtoken when mail refresh is gone", async () => {
    let keyringLogins = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasPasstoken: true }),
      ownerLoginFromKeyring: () => {
        keyringLogins += 1;
        return Promise.resolve(
          ownerStatus({
            hasPasstoken: true,
            hasMailRefresh: true,
            hasMailAccess: true,
          }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasPasstoken: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "keyring boot");
    assert.equal(keyringLogins, 1);
  });

  it("loginOwnerFromKeyring unlocks from UnlockView retry", async () => {
    let attempts = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasPasstoken: true }),
      ownerLoginFromKeyring: () => {
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(
            new Error("[UserCancel] - The user cancelled the authentication"),
          );
        }
        return Promise.resolve(
          ownerStatus({
            hasPasstoken: true,
            hasMailRefresh: true,
            hasMailAccess: true,
          }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasPasstoken: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "unlock", "unlock form");
    await store.loginOwnerFromKeyring();
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.ownerStatus?.hasMailAccess, true);
    assert.equal(attempts, 2);
  });

  it("canTryOwnerBio is false when keyring prefix mismatches worker", () => {
    const store = createStore({});
    connectOwner(store);
    store.setStatuses(
      ownerStatus({
        hasPasstoken: true,
        keyringPasstokenPrefix: "aaaa-bbbb",
      }),
      teamStatus({}),
    );
    store.workerPasstokenPrefix = "zzzz-yyyy";
    assert.equal(store.canTryOwnerBio, false);
    assert.equal(store.ownerBioPrefixMismatch, true);
  });

  it("surfaces boot keyring login failures on unlock", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasPasstoken: true,
        keyringPasstokenPrefix: "match-prefix",
        workerUrl: WORKER_URL,
      }),
      ownerLoginFromKeyring: () =>
        Promise.reject(new Error("Invalid credentials. Check the passtoken")),
      fetchWorkerPasstokenPrefix: () => Promise.resolve("match-prefix"),
    });
    connectOwner(store);
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.workerPasstokenPrefix = "match-prefix";
    store.setStatuses(
      ownerStatus({
        hasPasstoken: true,
        keyringPasstokenPrefix: "match-prefix",
        workerUrl: WORKER_URL,
      }),
      teamStatus({}),
    );
    await waitUntil(() => store.phase.kind === "unlock", "boot login fail");
    assert.match(store.error ?? "", /Passtoken didn't match/i);
  });

  it("lands on passtoken form when owner has workerUrl but no keyring", () => {
    const store = createStore({ ownerStatus: ownerStatus({}) });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({}), teamStatus({}));
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

  it("owner passtoken login enters ownerReady without offerBiometry", async () => {
    const store = createStore({
      ownerLogin: () =>
        Promise.resolve(
          ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
        ),
    });
    connectOwner(store);
    await store.loginWithPasstoken({
      workerUrl: WORKER_URL,
      passtoken: "rb_pass_abc123XYZ-_abcdefghij",
    });
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("invited login enters invitedReady without offerBiometry", async () => {
    const store = createStore({
      teamLogin: () =>
        Promise.resolve(teamStatus({ hasSecret: true, hasAccess: true })),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: SAMPLE_CREDENTIALS,
      teamIdentity: {
        workerUrl: WORKER_URL,
        accountEmail: "teammate@example.com",
        mobilePassword: "secret",
      },
    });
    await store.loginInvited({
      workerUrl: WORKER_URL,
      accountEmail: "teammate@example.com",
      mobilePassword: "secret",
    });
    assert.equal(store.phase.kind, "invitedReady");
  });

  it("ensureConsoleAccess returns true when console access already present", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true, hasConsoleAccess: true }),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasConsoleAccess: true }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, true);
    assert.equal(store.consoleGateOpen, false);
  });

  it("ensureConsoleAccess silently unlocks console when refresh is valid", async () => {
    let prompted = 0;
    let unlocked = 0;
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasConsoleRefresh: true,
      }),
      authenticateBiometry: () => {
        prompted += 1;
        return Promise.resolve();
      },
      ownerUnlockConsole: () => {
        unlocked += 1;
        return Promise.resolve(
          ownerStatus({
            hasMailAccess: true,
            hasConsoleRefresh: true,
            hasConsoleAccess: true,
          }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasConsoleRefresh: true }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, true);
    assert.equal(prompted, 0);
    assert.equal(unlocked, 1);
    assert.equal(store.hasConsoleAccess, true);
  });

  it("ensureConsoleAccess still returns true when identity refresh fails after unlock", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasConsoleRefresh: true,
      }),
      ownerUnlockConsole: () =>
        Promise.resolve(
          ownerStatus({
            hasMailAccess: true,
            hasConsoleRefresh: true,
            hasConsoleAccess: true,
          }),
        ),
      refreshIdentity: () => Promise.reject(new Error("identity refresh failed")),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasConsoleRefresh: true }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, true);
    assert.equal(store.hasConsoleAccess, true);
    assert.equal(store.consoleGateOpen, false);
  });

  it("ensureConsoleAccess stays on mail when Touch ID is dismissed", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasPasstoken: true,
      }),
      ownerLoginFromKeyring: () =>
        Promise.reject(new Error("[UserCancel] - The user cancelled the authentication")),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasPasstoken: true }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, false);
    assert.equal(store.consoleGateOpen, false);
  });

  it("ensureConsoleAccess stays on mail when the Worker is unreachable", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasConsoleRefresh: true,
      }),
      ownerUnlockConsole: () =>
        Promise.reject(
          new Error("Worker request failed: error sending request"),
        ),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasConsoleRefresh: true }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, false);
    assert.equal(store.consoleGateOpen, false);
  });

  it("ensureConsoleAccess uses keyring passtoken when console refresh is expired", async () => {
    let keyringLogins = 0;
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasConsoleRefresh: true,
        hasPasstoken: true,
      }),
      ownerUnlockConsole: () =>
        Promise.reject(
          new Error("Session expired. Sign in with your passtoken."),
        ),
      ownerLoginFromKeyring: () => {
        keyringLogins += 1;
        return Promise.resolve(
          ownerStatus({
            hasMailAccess: true,
            hasConsoleRefresh: true,
            hasConsoleAccess: true,
            hasPasstoken: true,
          }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({
        hasMailAccess: true,
        hasConsoleRefresh: true,
        hasPasstoken: true,
      }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, true);
    assert.equal(keyringLogins, 1);
    assert.equal(store.consoleGateOpen, false);
  });

  it("ensureConsoleAccess opens gate when console refresh is expired and no passtoken", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasConsoleRefresh: true,
      }),
      ownerUnlockConsole: () =>
        Promise.reject(
          new Error("Session expired. Sign in with your passtoken."),
        ),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasConsoleRefresh: true }),
      teamStatus({}),
    );
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, false);
    assert.equal(store.consoleGateOpen, true);
  });

  it("ensureConsoleAccess opens gate when console refresh is missing", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true }),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailAccess: true }), teamStatus({}));
    const ok = await store.ensureConsoleAccess();
    assert.equal(ok, false);
    assert.equal(store.consoleGateOpen, true);
  });

  it("handleConsoleUnauthorized opens the console gate", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true, hasConsoleAccess: false }),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasConsoleAccess: false }),
      teamStatus({}),
    );
    await store.handleConsoleUnauthorized();
    assert.equal(store.consoleGateOpen, true);
  });

  it("handleConsoleUnauthorized does not re-enter while the gate is open", async () => {
    let statusReads = 0;
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true }),
      ownerSessionStatus: () => {
        statusReads += 1;
        return Promise.resolve(ownerStatus({ hasMailAccess: true }));
      },
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailAccess: true }), teamStatus({}));
    await store.handleConsoleUnauthorized();
    assert.equal(store.consoleGateOpen, true);
    const readsAfterFirst = statusReads;
    await store.handleConsoleUnauthorized();
    assert.equal(statusReads, readsAfterFirst);
  });

  it("handleWorkerUnauthorized retries silent mail boot", async () => {
    let booted = 0;
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailRefresh: true,
        hasMailAccess: true,
      }),
      ownerSessionStatus: () =>
        Promise.resolve(ownerStatus({ hasMailRefresh: true })),
      ownerBootMail: () => {
        booted += 1;
        return Promise.resolve(
          ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.handleWorkerUnauthorized();
    assert.equal(booted, 1);
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("handleWorkerUnauthorized stays in the mailbox when the Worker is unreachable", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailRefresh: true,
        hasMailAccess: true,
      }),
      ownerSessionStatus: () =>
        Promise.resolve(ownerStatus({ hasMailRefresh: true })),
      ownerBootMail: () =>
        Promise.reject(
          new Error("Worker request failed: error sending request"),
        ),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailRefresh: true, hasMailAccess: true }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.handleWorkerUnauthorized();
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.workerUnreachable, true);
    assert.equal(store.canShowApp, true);
  });

  it("handleWorkerUnauthorized uses keyring passtoken when mail refresh is gone", async () => {
    let keyringLogins = 0;
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailAccess: true,
        hasPasstoken: true,
      }),
      ownerSessionStatus: () =>
        Promise.resolve(ownerStatus({ hasPasstoken: true })),
      ownerLoginFromKeyring: () => {
        keyringLogins += 1;
        return Promise.resolve(
          ownerStatus({
            hasPasstoken: true,
            hasMailRefresh: true,
            hasMailAccess: true,
          }),
        );
      },
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({ hasMailAccess: true, hasPasstoken: true }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.handleWorkerUnauthorized();
    assert.equal(keyringLogins, 1);
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("does not enter the mailbox without a connected Worker URL", () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true }),
    });
    store.setIdentity({
      ready: true,
      isDesktop: true,
      credentials: null,
      teamIdentity: null,
    });
    store.setStatuses(ownerStatus({ hasMailAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "choice");
    assert.equal(store.canShowApp, false);
  });

  it("loginConsoleWithPasstoken unlocks console after owner login", async () => {
    let loggedIn = 0;
    let unlocked = 0;
    const store = createStore({
      ownerLogin: () => {
        loggedIn += 1;
        return Promise.resolve(
          ownerStatus({
            hasMailRefresh: true,
            hasConsoleRefresh: true,
            hasMailAccess: true,
          }),
        );
      },
      ownerUnlockConsole: () => {
        unlocked += 1;
        return Promise.resolve(
          ownerStatus({
            hasMailRefresh: true,
            hasConsoleRefresh: true,
            hasMailAccess: true,
            hasConsoleAccess: true,
          }),
        );
      },
    });
    connectOwner(store);
    await store.loginConsoleWithPasstoken({
      workerUrl: WORKER_URL,
      passtoken: "rb_pass_abc123XYZ-_abcdefghij",
    });
    assert.equal(loggedIn, 1);
    assert.equal(unlocked, 1);
    assert.equal(store.hasConsoleAccess, true);
    assert.equal(store.consoleGateOpen, false);
  });

  it("switchToOwnerLogin forgets team session and enters owner unlock", async () => {
    let forgot = 0;
    const store = createStore({
      teamForgetSession: () => {
        forgot += 1;
        return Promise.resolve(teamStatus({}));
      },
      ownerSessionStatus: () =>
        Promise.resolve(ownerStatus({ hasMailRefresh: true })),
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
      ownerStatus({ hasMailRefresh: true }),
      teamStatus({ hasSecret: true, hasAccess: true }),
    );
    assert.equal(store.phase.kind, "invitedReady");
    await store.switchToOwnerLogin();
    assert.equal(forgot, 1);
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
    }
  });
});
