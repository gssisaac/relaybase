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

describe("AppSessionStore boot", () => {
  it("boots to ownerReady when the owner already has mail access", () => {
    const store = createStore({
      ownerStatus: ownerStatus({ hasMailAccess: true }),
    });
    connectOwner(store);
    store.setStatuses(ownerStatus({ hasMailAccess: true }), teamStatus({}));
    assert.equal(store.phase.kind, "ownerReady");
    assert.equal(store.canShowApp, true);
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
});
