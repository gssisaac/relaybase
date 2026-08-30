// @ts-ignore node:test types are not bundled under @cloudflare/workers-types
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  collectSendingHealth,
  evaluateSendingHealth,
  sendingRowMatchesDomain,
} from "./sending-health.ts";

describe("sendingRowMatchesDomain", () => {
  it("matches apex exactly, case-insensitive", () => {
    assert.equal(sendingRowMatchesDomain("Relaybase.xyz", "relaybase.xyz"), true);
    assert.equal(sendingRowMatchesDomain("kloyapp.com", "relaybase.xyz"), false);
  });

  it("matches leftmost wildcard under the zone, not the apex", () => {
    assert.equal(
      sendingRowMatchesDomain("*.example.com", "mail.example.com"),
      true,
    );
    assert.equal(sendingRowMatchesDomain("*.example.com", "example.com"), false);
  });
});

describe("evaluateSendingHealth", () => {
  it("is no_zone when the domain is not on the CF account", () => {
    const result = evaluateSendingHealth({
      domain: "missing.xyz",
      zoneId: null,
      sendingRows: [],
      hasCfBounceMx: false,
    });
    assert.equal(result.status, "no_zone");
    assert.equal(result.sendingOnboarded, false);
    assert.match(result.error ?? "", /not a zone/i);
  });

  it("is ready when the apex sending row is enabled", () => {
    const result = evaluateSendingHealth({
      domain: "kloyapp.com",
      zoneId: "zone-1",
      sendingRows: [{ name: "kloyapp.com", enabled: true }],
      hasCfBounceMx: null,
    });
    assert.deepEqual(
      { status: result.status, sendingEnabled: result.sendingEnabled },
      { status: "ready", sendingEnabled: true },
    );
    assert.equal(result.error, null);
  });

  it("is restricted when the apex row exists but sending is disabled", () => {
    const result = evaluateSendingHealth({
      domain: "relaybase.xyz",
      zoneId: "zone-2",
      sendingRows: [{ name: "relaybase.xyz", enabled: false }],
      hasCfBounceMx: false,
    });
    assert.equal(result.status, "restricted");
    assert.equal(result.sendingOnboarded, true);
    assert.equal(result.sendingEnabled, false);
    assert.match(result.error ?? "", /disabled/i);
  });

  it("falls back to cf-bounce MX when the subdomain list omits apex", () => {
    const result = evaluateSendingHealth({
      domain: "kloyapp.com",
      zoneId: "zone-1",
      sendingRows: [{ name: "mail.kloyapp.com", enabled: true }],
      hasCfBounceMx: true,
    });
    assert.equal(result.status, "ready");
    assert.equal(result.sendingOnboarded, true);
  });

  it("is restricted when neither apex row nor cf-bounce MX is present", () => {
    const result = evaluateSendingHealth({
      domain: "relaybase.xyz",
      zoneId: "zone-2",
      sendingRows: [],
      hasCfBounceMx: false,
    });
    assert.equal(result.status, "restricted");
    assert.equal(result.sendingOnboarded, false);
    assert.match(result.error ?? "", /verified destination/i);
  });

  it("is unknown when both probes failed", () => {
    const result = evaluateSendingHealth({
      domain: "relaybase.xyz",
      zoneId: "zone-2",
      sendingRows: null,
      hasCfBounceMx: null,
    });
    assert.equal(result.status, "unknown");
    assert.match(result.error ?? "", /Could not check/i);
  });
});

describe("collectSendingHealth", () => {
  it("marks every domain unknown when Cloudflare is not configured", async () => {
    const snapshot = await collectSendingHealth(["Relaybase.xyz"], null, {
      generatedAt: "2026-01-01T00:00:00.000Z",
      probeError: "Cloudflare API is not configured",
    });
    assert.equal(snapshot.domains[0]?.status, "unknown");
    assert.match(snapshot.domains[0]?.error ?? "", /not configured/i);
  });

  it("probes bounce MX only when the apex sending row is missing", async () => {
    let bounceCalls = 0;
    const snapshot = await collectSendingHealth(
      ["kloyapp.com", "relaybase.xyz"],
      {
        async listZones() {
          return [
            { id: "z-kloy", name: "kloyapp.com" },
            { id: "z-rb", name: "relaybase.xyz" },
          ];
        },
        async listSendingSubdomains(zoneId) {
          if (zoneId === "z-kloy") {
            return [{ name: "kloyapp.com", enabled: true }];
          }
          return [];
        },
        async hasSendingBounceMx() {
          bounceCalls += 1;
          return false;
        },
      },
      { generatedAt: "2026-01-01T00:00:00.000Z", accountId: "acc" },
    );
    assert.equal(bounceCalls, 1);
    assert.equal(
      snapshot.domains.find((d) => d.domain === "kloyapp.com")?.status,
      "ready",
    );
    assert.equal(
      snapshot.domains.find((d) => d.domain === "relaybase.xyz")?.status,
      "restricted",
    );
  });
});
