import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  domainFromEmail,
  isSendingWarningStatus,
  sendingWarningDescription,
  showSendingCloudflareLink,
  statusForEmail,
  type SendingHealthSnapshot,
} from "./sending-health.ts";
import {
  formatWorkerApiError,
  isWorkerRouteMissingMessage,
  rewriteBareWorkerError,
  WORKER_ROUTE_MISSING_MESSAGE,
} from "./worker-api-error.ts";

const snapshot: SendingHealthSnapshot = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  domains: [
    {
      domain: "relaybase.xyz",
      status: "restricted",
      sendingEnabled: false,
      sendingOnboarded: false,
      zoneId: "z1",
      error: "restricted",
      code: null,
      cloudflareSendingUrl: null,
    },
    {
      domain: "kloyapp.com",
      status: "ready",
      sendingEnabled: true,
      sendingOnboarded: true,
      zoneId: "z2",
      error: null,
      code: null,
      cloudflareSendingUrl: null,
    },
  ],
};

describe("sending-health helpers", () => {
  it("maps email to domain status and only warns on restricted/no_zone", () => {
    assert.equal(domainFromEmail("beta@relaybase.xyz"), "relaybase.xyz");
    assert.equal(statusForEmail(snapshot, "beta@relaybase.xyz")?.status, "restricted");
    assert.equal(statusForEmail(snapshot, "isaac@kloyapp.com")?.status, "ready");
    assert.equal(isSendingWarningStatus("restricted"), true);
    assert.equal(isSendingWarningStatus("no_zone"), true);
    assert.equal(isSendingWarningStatus("unknown"), false);
    assert.equal(isSendingWarningStatus("ready"), false);
  });

  it("uses owner-ask copy for team users and hides the Cloudflare link", () => {
    assert.match(
      sendingWarningDescription("restricted", "team", "Email Sending is not onboarded."),
      /ask the owner/i,
    );
    assert.doesNotMatch(
      sendingWarningDescription("restricted", "team", "Email Sending is not onboarded."),
      /cloudflare/i,
    );
    assert.equal(showSendingCloudflareLink("team", "https://dash.cloudflare.com"), false);
    assert.equal(showSendingCloudflareLink("owner", "https://dash.cloudflare.com"), true);
    assert.match(
      sendingWarningDescription("restricted", "owner", "Email Sending is not onboarded."),
      /onboarded/i,
    );
  });
});

describe("formatWorkerApiError", () => {
  it("never surfaces raw Not found — points at a Worker version mismatch", () => {
    assert.equal(formatWorkerApiError(404, "Not found", "Sending health"), WORKER_ROUTE_MISSING_MESSAGE);
    assert.equal(formatWorkerApiError(404, undefined, "Sending health"), WORKER_ROUTE_MISSING_MESSAGE);
    assert.equal(formatWorkerApiError(502, "Not found", "Sending health"), WORKER_ROUTE_MISSING_MESSAGE);
    assert.equal(rewriteBareWorkerError("Not found"), WORKER_ROUTE_MISSING_MESSAGE);
    assert.equal(isWorkerRouteMissingMessage(WORKER_ROUTE_MISSING_MESSAGE), true);
  });

  it("keeps specific Worker errors and rewrites opaque status text", () => {
    assert.equal(
      formatWorkerApiError(502, "Cloudflare API token is not configured", "Sending health"),
      "Cloudflare API token is not configured",
    );
    assert.match(
      formatWorkerApiError(500, "Internal Server Error", "Sending health"),
      /HTTP 500/,
    );
  });
});
