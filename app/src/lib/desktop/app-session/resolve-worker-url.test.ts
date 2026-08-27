import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWorkerUrl } from "./resolve-worker-url.ts";

const WORKER_URL = "https://relaybase-api.example.workers.dev";
const KEYRING_URL = "https://relaybase-api.keyring.workers.dev";

describe("resolveWorkerUrl", () => {
  it("prefers owner keyring workerUrl over credentials.json", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "owner",
        ownerStatus: { workerUrl: KEYRING_URL } as never,
        credentials: { workerUrl: WORKER_URL } as never,
      }),
      KEYRING_URL,
    );
  });

  it("falls back to credentials.json when owner keyring has no URL", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "owner",
        ownerStatus: { workerUrl: "" } as never,
        credentials: { workerUrl: WORKER_URL } as never,
      }),
      WORKER_URL,
    );
  });

  it("prefers team keyring workerUrl over team-login.json", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "invited",
        teamStatus: { workerUrl: KEYRING_URL } as never,
        teamLogin: { workerUrl: WORKER_URL } as never,
      }),
      KEYRING_URL,
    );
  });
});
