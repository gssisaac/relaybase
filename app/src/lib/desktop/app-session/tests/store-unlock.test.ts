import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  OwnerSessionStatus,
  TeamSessionStatus,
} from "../../bridge/index.ts";

import {
  SAMPLE_CREDENTIALS,
  WORKER_URL,
  connectOwner,
  createStore,
  ownerStatus,
  teamStatus,
  waitUntil,
} from "./helpers.ts";

describe("AppSessionStore unlock", () => {
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

  it("refreshOwnerForWorker loads keyring flags for that Worker URL", async () => {
    const kembo = "https://relaybase-api.kembo.workers.dev";
    const isaac = "https://relaybase-api.gssisaac.workers.dev";
    const store = createStore({
      ownerSessionStatus: (url) =>
        Promise.resolve(
          ownerStatus({
            hasPasstoken: url === kembo,
            workerUrl: url ?? "",
            knownWorkerUrls: [kembo],
          }),
        ),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasPasstoken: false, workerUrl: isaac }), teamStatus({}));
    await store.refreshOwnerForWorker(kembo);
    assert.equal(store.ownerStatus?.hasPasstoken, true);
    assert.equal(store.canTryOwnerBio, true);
    await store.refreshOwnerForWorker(isaac);
    assert.equal(store.ownerStatus?.hasPasstoken, false);
    assert.equal(store.canTryOwnerBio, false);
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

  it("transitions to unlock phase when mail refresh and Touch ID both fail on boot", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailRefresh: true,
        hasPasstoken: true,
        workerUrl: WORKER_URL,
      }),
      ownerSessionStatus: () =>
        Promise.resolve(
          ownerStatus({
            hasMailRefresh: false,
            hasPasstoken: true,
            workerUrl: WORKER_URL,
          }),
        ),
      ownerBootMail: () =>
        Promise.reject(
          new Error("Session expired. Sign in with your passtoken."),
        ),
      ownerLoginFromKeyring: () =>
        Promise.reject(
          new Error("[UserCancel] - The user cancelled the authentication"),
        ),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({
        hasMailRefresh: true,
        hasPasstoken: true,
        workerUrl: WORKER_URL,
      }),
      teamStatus({}),
    );
    await waitUntil(() => store.phase.kind === "unlock", "unlock after bio cancel");
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
    }
    assert.equal(store.canShowApp, false);
    assert.equal(store.workerUnreachable, false);
    assert.equal(store.bioDismissed, true);
  });
});
