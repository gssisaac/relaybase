import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WORKER_URL,
  connectOwner,
  createStore,
  ownerStatus,
  teamStatus,
} from "./helpers.ts";

describe("AppSessionStore console", () => {
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
});
