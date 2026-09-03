import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WORKER_URL,
  connectOwner,
  createStore,
  ownerStatus,
  teamStatus,
  waitUntil,
} from "./helpers.ts";

describe("AppSessionStore unauthorized", () => {
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

  it("boots to Touch ID login when mail refresh fails with 401 but owner-passtoken exists", async () => {
    let keyringLogins = 0;
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
      ownerLoginFromKeyring: () => {
        keyringLogins += 1;
        return Promise.resolve(
          ownerStatus({
            hasPasstoken: true,
            hasMailRefresh: true,
            hasMailAccess: true,
            workerUrl: WORKER_URL,
          }),
        );
      },
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
    await waitUntil(() => store.phase.kind === "ownerReady", "fallback keyring boot");
    assert.equal(keyringLogins, 1);
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
    assert.equal(store.workerUnreachable, false);
  });

  it("handleWorkerUnauthorized transitions to unlock phase when silent recovery fails", async () => {
    const store = createStore({
      ownerStatus: ownerStatus({
        hasMailRefresh: true,
        hasMailAccess: true,
        workerUrl: WORKER_URL,
      }),
      ownerSessionStatus: () =>
        Promise.resolve(
          ownerStatus({
            hasMailRefresh: false,
            hasPasstoken: false,
            workerUrl: WORKER_URL,
          }),
        ),
      ownerBootMail: () =>
        Promise.reject(
          new Error("Session expired. Sign in with your passtoken."),
        ),
    });
    connectOwner(store);
    store.setStatuses(
      ownerStatus({
        hasMailRefresh: true,
        hasMailAccess: true,
        workerUrl: WORKER_URL,
      }),
      teamStatus({}),
    );
    assert.equal(store.phase.kind, "ownerReady");
    await store.handleWorkerUnauthorized();
    assert.equal(store.phase.kind, "unlock");
    if (store.phase.kind === "unlock") {
      assert.equal(store.phase.role, "owner");
    }
    assert.equal(store.canShowApp, false);
  });
});
