import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CF_WORKERS_PAID_REQUIRED_CODE,
  isCloudflarePlanError,
} from "./plan-required.ts";

describe("isCloudflarePlanError", () => {
  it("matches CF REST code 10105 in error text", () => {
    assert.equal(
      isCloudflarePlanError(
        "Cloudflare API: [10105] email.sending.error.authentication.not_entitled",
      ),
      true,
    );
  });

  it("matches Relaybase API code", () => {
    assert.equal(
      isCloudflarePlanError({
        error: "Sending requires a Cloudflare Workers Paid plan.",
        code: CF_WORKERS_PAID_REQUIRED_CODE,
      }),
      true,
    );
  });

  it("matches workers paid phrasing", () => {
    assert.equal(
      isCloudflarePlanError("Upgrade to Workers Paid to send email."),
      true,
    );
  });

  it("matches zone Email Sending [2036] Unauthorized (Workers Free)", () => {
    assert.equal(
      isCloudflarePlanError(
        "Cloudflare API: [2036] Unauthorized\nAPI: GET /zones/abc/email/sending/subdomains",
      ),
      true,
    );
  });

  it("does not match [2036] outside Email Sending", () => {
    assert.equal(
      isCloudflarePlanError(
        "Cloudflare API: [2036] Unauthorized\nAPI: GET /zones/abc/dns_records",
      ),
      false,
    );
  });

  it("does not match sending_disabled / domain setup errors", () => {
    assert.equal(
      isCloudflarePlanError(
        "Cloudflare API: [10203] email.sending.error.email.sending_disabled",
      ),
      false,
    );
  });

  it("does not match generic send failures", () => {
    assert.equal(isCloudflarePlanError("Send failed"), false);
  });
});
