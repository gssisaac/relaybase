import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { connectedCfAccountId, displayCfAccountId, resolveEffectiveCfAccountId, mailApiReady, cfApiTokenHealth, cfApiTokenPermissionsRejected, formatCfTokenAccessFix, cfTokenPermissionChecks, cloudflareEmailSendingUrl, cloudflareDomainsOverviewUrl, cloudflareR2BucketUrl, cloudflareEmailRoutingOverviewUrl, cloudflareEmailRoutingRulesUrl } from "./cloudflare.ts";

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

describe("cfApiTokenHealth", () => {
  it("distinguishes missing token from rejected permissions", () => {
    assert.deepEqual(cfApiTokenHealth(null), {
      tone: "bad",
      label: "Not configured",
      detail: "Use Enable email API to add the token, then verify.",
    });
    assert.deepEqual(
      cfApiTokenHealth({ cfApiTokenSet: true, cfApiTokenValid: false }),
      {
        tone: "bad",
        label: "Permissions need fixing",
        detail:
          "CF_API_TOKEN is on the Worker, but Cloudflare rejected one or more permissions. Verify again to see which row to fix.",
      },
    );
    assert.deepEqual(
      cfApiTokenHealth({ cfApiTokenSet: true, cfApiTokenValid: true }),
      {
        tone: "ok",
        label: "Configured",
        detail: "The API token is set on the Worker and Cloudflare accepted it.",
      },
    );
  });

  it("flags rejected permissions without treating the token as missing", () => {
    assert.equal(
      cfApiTokenPermissionsRejected({
        cfApiTokenSet: true,
        cfApiTokenValid: false,
      }),
      true,
    );
    assert.equal(
      cfApiTokenPermissionsRejected({ cfApiTokenSet: false }),
      false,
    );
  });
});

describe("formatCfTokenAccessFix", () => {
  it("shows Read → Edit when the row exists but is read-only", () => {
    const checks = cfTokenPermissionChecks({
      zoneRead: "ok",
      emailRoutingRead: "ok",
      emailRoutingEdit: "ok",
      dnsEdit: "read_only",
    });
    const dns = checks.find((row) => row.id === "dnsEdit");
    assert.equal(dns && formatCfTokenAccessFix(dns), "Read → Edit");
  });

  it("shows Missing → Edit when the permission row is absent", () => {
    const checks = cfTokenPermissionChecks({
      zoneRead: "ok",
      emailRoutingRead: "ok",
      emailRoutingEdit: "missing",
      dnsEdit: "ok",
    });
    const routing = checks.find((row) => row.id === "emailRoutingEdit");
    assert.equal(
      routing && formatCfTokenAccessFix(routing),
      "Missing → Edit",
    );
  });

  it("shows Missing → Read when Zone Read is absent", () => {
    const checks = cfTokenPermissionChecks({
      zoneRead: "missing",
      emailRoutingRead: "skipped",
      emailRoutingEdit: "skipped",
      dnsEdit: "skipped",
    });
    const zone = checks.find((row) => row.id === "zoneRead");
    assert.equal(zone && formatCfTokenAccessFix(zone), "Missing → Read");
  });

  it("shows Missing → Read when Email Routing Read is absent", () => {
    const checks = cfTokenPermissionChecks({
      zoneRead: "ok",
      emailRoutingRead: "missing",
      emailRoutingEdit: "ok",
      dnsEdit: "ok",
    });
    const routing = checks.find((row) => row.id === "emailRoutingRead");
    assert.equal(
      routing && formatCfTokenAccessFix(routing),
      "Missing → Read",
    );
  });
});

describe("resolveEffectiveCfAccountId", () => {
  it("prefers workerAccountId, then credentials accountId, then OAuth accountId", () => {
    assert.equal(
      resolveEffectiveCfAccountId({
        workerAccountId: "aa".repeat(16),
        credentialsAccountId: "bb".repeat(16),
        cfOauthAccountId: "cc".repeat(16),
      }),
      "aa".repeat(16),
    );
    assert.equal(
      resolveEffectiveCfAccountId({
        workerAccountId: "",
        credentialsAccountId: "bb".repeat(16),
        cfOauthAccountId: "cc".repeat(16),
      }),
      "bb".repeat(16),
    );
    assert.equal(
      resolveEffectiveCfAccountId({
        workerAccountId: "",
        credentialsAccountId: "",
        cfOauthAccountId: "cc".repeat(16),
      }),
      "cc".repeat(16),
    );
    assert.equal(resolveEffectiveCfAccountId(null), "");
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

  it("builds R2 bucket deep links", () => {
    assert.equal(
      cloudflareR2BucketUrl(accountId, "relaybase-mailbox"),
      `https://dash.cloudflare.com/${accountId}/r2/default/buckets/relaybase-mailbox`,
    );
    assert.equal(
      cloudflareR2BucketUrl(accountId, ""),
      `https://dash.cloudflare.com/${accountId}/r2/overview`,
    );
    assert.equal(cloudflareR2BucketUrl("", "relaybase-mailbox"), "https://dash.cloudflare.com/");
  });

  it("builds zone-scoped email routing deep links", () => {
    const zoneId = "b".repeat(32);
    assert.equal(
      cloudflareEmailRoutingOverviewUrl(accountId, zoneId),
      `https://dash.cloudflare.com/${accountId}/email-service/routing/${zoneId}/overview`,
    );
    assert.equal(
      cloudflareEmailRoutingRulesUrl(accountId, zoneId),
      `https://dash.cloudflare.com/${accountId}/email-service/routing/${zoneId}/routing-rules`,
    );
  });

  it("falls back to the routing zone list without a zone id, dashboard home without an account id", () => {
    assert.equal(
      cloudflareEmailRoutingOverviewUrl(accountId, null),
      `https://dash.cloudflare.com/${accountId}/email-service/routing`,
    );
    assert.equal(
      cloudflareEmailRoutingRulesUrl(accountId, "  "),
      `https://dash.cloudflare.com/${accountId}/email-service/routing`,
    );
    assert.equal(
      cloudflareEmailRoutingOverviewUrl("", "b".repeat(32)),
      "https://dash.cloudflare.com/",
    );
  });
});
