import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWorkerUrl } from "./resolve-worker-url.ts";

const WORKER_URL = "https://relaybase-api.example.workers.dev";
const KEYRING_URL = "https://relaybase-api.keyring.workers.dev";

describe("resolveWorkerUrl", () => {
  it("uses workspace.json for owner role", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "owner",
        ownerStatus: { workerUrl: KEYRING_URL } as never,
        credentials: { workerUrl: WORKER_URL } as never,
      }),
      WORKER_URL,
    );
  });

  it("returns empty string when owner credentials has no URL", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "owner",
        ownerStatus: { workerUrl: KEYRING_URL } as never,
        credentials: { workerUrl: "" } as never,
      }),
      "",
    );
  });

  it("uses team-login.json for invited role", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "invited",
        teamStatus: { workerUrl: KEYRING_URL } as never,
        teamLogin: { workerUrl: WORKER_URL } as never,
      }),
      WORKER_URL,
    );
  });

  it("falls back to workspace.json for invited role when teamLogin is missing", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "invited",
        teamStatus: { workerUrl: KEYRING_URL } as never,
        credentials: { workerUrl: WORKER_URL } as never,
      }),
      WORKER_URL,
    );
  });

  it("returns empty string when invited has neither teamLogin nor credentials", () => {
    assert.equal(
      resolveWorkerUrl({
        role: "invited",
        teamStatus: { workerUrl: KEYRING_URL } as never,
      }),
      "",
    );
  });
});
