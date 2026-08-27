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

function makeDeps(overrides: {
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
  teamSetBiometryEnabled?: (enabled: boolean) => Promise<TeamSessionStatus>;
  isDesktop?: () => boolean;
}) {
  return {
    isDesktop: overrides.isDesktop ?? (() => true),
    authenticateBiometry:
      overrides.authenticateBiometry ?? (() => Promise.resolve()),
    ownerSessionStatus: () =>
      Promise.resolve(overrides.ownerStatus ?? ownerStatus({})),
    ownerLogin: overrides.ownerLogin ??
      (() => Promise.resolve(ownerStatus({ hasAccess: true }))),
    ownerUnlock: overrides.ownerUnlock ??
      (() => Promise.resolve(ownerStatus({ hasAccess: true }))),
    ownerLogout: () => Promise.resolve(),
    ownerSetupAdmin: () => Promise.resolve({ username: "owner", passtoken: "p" }),
    ownerResetAdmin: () => Promise.resolve({ username: "owner", passtoken: "p" }),
    teamSessionStatus: () =>
      Promise.resolve(overrides.teamStatus ?? teamStatus({})),
    teamLogin: overrides.teamLogin ??
      (() => Promise.resolve(teamStatus({ hasAccess: true }))),
    teamUnlock: overrides.teamUnlock ??
      (() => Promise.resolve(teamStatus({ hasAccess: true }))),
    teamLogout: () => Promise.resolve(),
    teamSetBiometryEnabled: overrides.teamSetBiometryEnabled ??
      ((enabled: boolean) =>
        Promise.resolve(teamStatus({ hasAccess: true, biometryEnabled: enabled }))),
  };
}

describe("AppSessionStore", () => {
  it("boots to ownerReady when the owner already has access", () => {
    const store = new AppSessionStore(
      makeDeps({
        ownerStatus: ownerStatus({
          hasAccess: true,
          workerUrl: "https://relaybase-api.example.workers.dev",
        }),
      }),
    );
    store.setStatuses(
      ownerStatus({
        hasAccess: true,
        workerUrl: "https://relaybase-api.example.workers.dev",
      }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
  });

  it("boots to unlock prompting and fires Touch ID when owner has refresh", async () => {
    let prompted = 0;
    let unlocked = 0;
    const store = new AppSessionStore(
      makeDeps({
        ownerStatus: ownerStatus({ hasRefresh: true }),
        authenticateBiometry: () => {
          prompted += 1;
          return Promise.resolve();
        },
        ownerUnlock: () => {
          unlocked += 1;
          return Promise.resolve(ownerStatus({ hasAccess: true }));
        },
      }),
    );
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    assert.equal(store.phase.kind, "unlock");
    assert.equal(store.needsUnlockPrompt, true);
    await waitUntil(() => store.phase.kind === "ownerReady", "owner did not unlock");
    assert.equal(prompted, 1);
    assert.equal(unlocked, 1);
  });

  it("lands on UnlockView idle when owner has workerUrl but no keyring", () => {
    const store = new AppSessionStore(
      makeDeps({ ownerStatus: ownerStatus({}) }),
    );
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
      assert.equal(store.phase.mode, "idle");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("shows UnlockView from workerUrl before keyring status arrives", () => {
    const store = new AppSessionStore(makeDeps({}));
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
      assert.equal(store.phase.mode, "idle");
    }
  });

  it("requestPrompt leaves the secret form even without a keyring secret", () => {
    const store = new AppSessionStore(makeDeps({}));
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
      assert.equal(store.phase.mode, "idle");
    }
  });

  it("leaveRecover returns to UnlockView idle", () => {
    const store = new AppSessionStore(makeDeps({}));
    store.enterRecover();
    assert.equal(store.phase.kind, "ownerRecover");
    store.leaveRecover();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
      assert.equal(store.phase.role, "owner");
    }
  });

  it("lands on choice when nothing is enrolled", () => {
    const store = new AppSessionStore(makeDeps({}));
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
    const store = new AppSessionStore(
      makeDeps({
        teamStatus: teamStatus({ hasSecret: true }),
        authenticateBiometry: () => {
          prompted += 1;
          return Promise.resolve();
        },
        teamUnlock: () => {
          unlocked += 1;
          return Promise.resolve(teamStatus({ hasAccess: true }));
        },
      }),
    );
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

  it("first invited login offers biometry, then accept enters the app", async () => {
    let enableCalls = 0;
    const store = new AppSessionStore(
      makeDeps({
        teamLogin: () =>
          Promise.resolve(teamStatus({ hasAccess: true, platform: "macos" })),
        teamSetBiometryEnabled: (enabled: boolean) => {
          enableCalls += 1;
          assert.equal(enabled, true);
          return Promise.resolve(
            teamStatus({ hasAccess: true, biometryEnabled: true }),
          );
        },
      }),
    );
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
    const store = new AppSessionStore(
      makeDeps({
        teamLogin: () =>
          Promise.resolve(teamStatus({ hasAccess: true, platform: "macos" })),
        teamSetBiometryEnabled: (enabled: boolean) => {
          enableCalls += 1;
          assert.equal(enabled, false);
          return Promise.resolve(
            teamStatus({ hasAccess: true, biometryEnabled: false }),
          );
        },
      }),
    );
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
    const store = new AppSessionStore(
      makeDeps({
        isDesktop: () => desktop,
        ownerStatus: ownerStatus({ hasRefresh: true }),
        authenticateBiometry: () => {
          prompted += 1;
          return Promise.resolve();
        },
        ownerUnlock: () =>
          Promise.resolve(ownerStatus({ hasAccess: true })),
      }),
    );
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
    const store = new AppSessionStore(
      makeDeps({
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
        ownerUnlock: () =>
          Promise.resolve(ownerStatus({ hasAccess: true })),
      }),
    );
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(prompted, 2);
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("keeps ownerReady when a stale empty status arrives after unlock", async () => {
    const store = new AppSessionStore(
      makeDeps({
        ownerStatus: ownerStatus({ hasRefresh: true }),
        ownerUnlock: () =>
          Promise.resolve(ownerStatus({ hasRefresh: true, hasAccess: true })),
      }),
    );
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await waitUntil(() => store.phase.kind === "ownerReady", "did not unlock");
    store.setStatuses(ownerStatus({}), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
  });

  it("does not open the passtoken form when unlock fails after Touch ID", async () => {
    const store = new AppSessionStore(
      makeDeps({
        ownerStatus: ownerStatus({ hasRefresh: true }),
        ownerUnlock: () =>
          Promise.reject(
            new Error("No saved session. Sign in with your username and passtoken."),
          ),
      }),
    );
    store.setStatuses(ownerStatus({ hasRefresh: true }), teamStatus({}));
    await waitUntil(() => {
      if (store.busy || store.phase.kind !== "unlock") return false;
      return store.phase.mode === "idle";
    }, "unlock did not settle on idle");
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.mode, "idle");
    }
  });

  it("a dismissed biometry prompt falls back to idle, not an error", async () => {
    const store = new AppSessionStore(
      makeDeps({
        ownerStatus: ownerStatus({ hasRefresh: true }),
        authenticateBiometry: () =>
          Promise.reject(new Error("userCancel")),
        ownerUnlock: () => Promise.resolve(ownerStatus({ hasAccess: true })),
      }),
    );
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
    const store = new AppSessionStore(
      makeDeps({ ownerStatus: ownerStatus({ hasAccess: true }) }),
    );
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
    const store = new AppSessionStore(
      makeDeps({ ownerStatus: ownerStatus({ hasAccess: true }) }),
    );
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

  it("signOut resets to choice", async () => {
    const store = new AppSessionStore(
      makeDeps({
        ownerStatus: ownerStatus({
          hasAccess: true,
          workerUrl: "https://relaybase-api.example.workers.dev",
        }),
      }),
    );
    store.setStatuses(
      ownerStatus({
        hasAccess: true,
        workerUrl: "https://relaybase-api.example.workers.dev",
      }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.signOut();
    assert.equal(store.phase.kind, "choice");
    assert.equal(store.ownerStatus, null);
  });
});
