import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkingHealth,
  connectionHealthFromSnapshot,
} from "./connection-health.ts";

describe("checkingHealth", () => {
  it("uses the pending tone and Checking label", () => {
    assert.deepEqual(checkingHealth("Probing Worker connection."), {
      tone: "pending",
      label: "Checking…",
      detail: "Probing Worker connection.",
    });
  });
});

describe("connectionHealthFromSnapshot", () => {
  it("does not treat an in-flight probe as Not configured", () => {
    const health = connectionHealthFromSnapshot(
      {
        cfConnected: false,
        worker: {
          ok: false,
          workerUrl: "https://relaybase-api.example.workers.dev",
          r2Configured: false,
        },
      },
      { pending: true, hasWorkerCredentials: true },
    );
    assert.equal(health.cf.tone, "pending");
    assert.equal(health.cf.label, "Checking…");
    assert.equal(health.worker.tone, "pending");
    assert.equal(health.worker.label, "Checking…");
    assert.equal(health.r2.tone, "pending");
    assert.equal(health.r2.label, "Checking…");
    assert.equal(health.d1.tone, "pending");
    assert.equal(health.d1.label, "Checking…");
  });

  it("shows Checking when the snapshot is still empty", () => {
    const health = connectionHealthFromSnapshot(null, {
      pending: true,
      hasWorkerCredentials: true,
    });
    assert.equal(health.cf.label, "Checking…");
    assert.equal(health.worker.label, "Checking…");
    assert.equal(health.r2.label, "Checking…");
    assert.equal(health.d1.label, "Checking…");
  });

  it("keeps a confirmed healthy result while a refresh is in flight", () => {
    const health = connectionHealthFromSnapshot(
      {
        cfConnected: true,
        worker: {
          ok: true,
          workerUrl: "https://relaybase-api.example.workers.dev",
          r2Configured: true,
          cfApiTokenSet: true,
          cfApiTokenValid: true,
          d1Logs: { configured: true },
          d1Mail: { configured: true },
          d1App: { configured: true },
        },
      },
      { pending: true, hasWorkerCredentials: true },
    );
    assert.equal(health.cf.label, "Configured");
    assert.equal(health.worker.label, "Healthy");
    assert.equal(health.r2.label, "Configured");
    assert.equal(health.d1.label, "Configured");
  });

  it("shows Not configured only after the probe has settled", () => {
    const health = connectionHealthFromSnapshot(
      {
        cfConnected: false,
        worker: {
          ok: false,
          workerUrl: "https://relaybase-api.example.workers.dev",
          r2Configured: false,
        },
      },
      { pending: false, hasWorkerCredentials: true },
    );
    assert.equal(health.cf.tone, "bad");
    assert.equal(health.cf.label, "Not configured");
    assert.equal(health.worker.label, "Unreachable");
    assert.equal(health.r2.label, "Not configured");
    assert.equal(health.d1.label, "Not configured");
  });
});
