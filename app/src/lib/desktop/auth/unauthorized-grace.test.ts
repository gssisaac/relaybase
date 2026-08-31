import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  WORKER_UPDATE_GRACE_MS,
  isUnauthorizedGraceActive,
  markWorkerUpdateGrace,
} from "./unauthorized-grace.ts";

function installSessionStorage() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  (globalThis as { window?: { sessionStorage: typeof sessionStorage } }).window =
    { sessionStorage };
}

describe("unauthorized grace", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("is inactive by default", () => {
    installSessionStorage();
    assert.equal(isUnauthorizedGraceActive(), false);
  });

  it("is active immediately after a Worker update grace mark", () => {
    installSessionStorage();
    markWorkerUpdateGrace();
    assert.equal(isUnauthorizedGraceActive(), true);
  });

  it("expires after the grace window", () => {
    installSessionStorage();
    const now = Date.now();
    markWorkerUpdateGrace(WORKER_UPDATE_GRACE_MS);
    const originalNow = Date.now;
    Date.now = () => now + WORKER_UPDATE_GRACE_MS + 1;
    try {
      assert.equal(isUnauthorizedGraceActive(), false);
    } finally {
      Date.now = originalNow;
    }
  });
});
