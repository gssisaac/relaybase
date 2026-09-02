import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { connectedCfAccountId, displayCfAccountId, mailApiReady, cloudflareEmailSendingUrl, cloudflareDomainsOverviewUrl } from "./cloudflare.ts";

describe("mailApiReady", () => {
  it("is ready when the token is set and the probe is not false", () => {
    assert.equal(mailApiReady({ cfApiTokenSet: true }), true);
    assert.equal(
      mailApiReady({ cfApiTokenSet: true, cfApiTokenValid: true }),
      true,
    );
  });

  it("does not require Worker accountId", () => {
    assert.equal(
      mailApiReady({ cfApiTokenSet: true, cfApiTokenValid: true, accountId: "" }),
      true,
    );
  });

  it("fails when the token is missing or Cloudflare rejected it", () => {
    assert.equal(mailApiReady({}), false);
    assert.equal(mailApiReady({ cfApiTokenSet: false }), false);
    assert.equal(
      mailApiReady({ cfApiTokenSet: true, cfApiTokenValid: false }),
      false,
    );
  });
});

describe("displayCfAccountId", () => {
  it("prefers the Worker id, then credentials", () => {
    assert.equal(
      displayCfAccountId({
        workerAccountId: "aa".repeat(16),
        credentialsAccountId: "bb".repeat(16),
      }),
      "aa".repeat(16),
    );
    assert.equal(
      displayCfAccountId({
        workerAccountId: "  ",
        credentialsAccountId: "bb".repeat(16),
      }),
      "bb".repeat(16),
    );
    assert.equal(displayCfAccountId({}), "");
  });
});

describe("connectedCfAccountId", () => {
  it("prefers workspace accountId over the OAuth overlay", () => {
    assert.equal(
      connectedCfAccountId({
        accountId: "aa".repeat(16),
        cfOauthAccountId: "bb".repeat(16),
      }),
      "aa".repeat(16),
    );
    assert.equal(
      connectedCfAccountId({
        accountId: "",
        cfOauthAccountId: "bb".repeat(16),
      }),
      "bb".repeat(16),
    );
    assert.equal(connectedCfAccountId(null), "");
  });
});

describe("cloudflare dashboard urls", () => {
  const accountId = "a".repeat(32);

  it("builds email sending and domains overview with account id", () => {
    assert.equal(
      cloudflareEmailSendingUrl(accountId),
      `https://dash.cloudflare.com/${accountId}/email-service/sending`,
    );
    assert.equal(
      cloudflareDomainsOverviewUrl(accountId),
      `https://dash.cloudflare.com/${accountId}/domains/overview`,
    );
  });

  it("falls back to dashboard home without account id", () => {
    assert.equal(cloudflareEmailSendingUrl(""), "https://dash.cloudflare.com/");
    assert.equal(cloudflareDomainsOverviewUrl("  "), "https://dash.cloudflare.com/");
  });
});
