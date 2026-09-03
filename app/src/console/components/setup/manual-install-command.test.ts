import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStorageInitCommand,
  buildVerifyCommand,
  buildWorkerInstallCommand,
  buildWranglerInstallCommand,
  resolveManualWorkerUrl,
  workerUpdateCommand,
} from "./manual-install-command.ts";

const PEPPER = "ab".repeat(16);
const ZIP =
  "https://github.com/strum-us/relaybase-worker/releases/latest/download/relaybase-worker-install.zip";
const WORKER = "https://relaybase-api.gssisaac.workers.dev";

describe("resolveManualWorkerUrl", () => {
  it("builds the default URL from a subdomain slug", () => {
    assert.equal(resolveManualWorkerUrl("GssIsaac"), WORKER);
  });

  it("normalizes a full Worker URL", () => {
    assert.equal(resolveManualWorkerUrl(`${WORKER}/`), WORKER);
  });
});

describe("buildWranglerInstallCommand", () => {
  it("installs wrangler, logs in, and shows whoami", () => {
    const cmd = buildWranglerInstallCommand();
    assert.match(cmd, /npm install -g wrangler/);
    assert.match(cmd, /wrangler login/);
    assert.match(cmd, /wrangler whoami/);
    assert.doesNotMatch(cmd, /d1 create/);
    assert.doesNotMatch(cmd, /wrangler deploy/);
  });
});

describe("buildWorkerInstallCommand", () => {
  const cmd = buildWorkerInstallCommand({ pepper: PEPPER, zipUrl: ZIP });

  it("downloads, sets pepper, and deploys", () => {
    assert.match(cmd, /relaybase-worker-install\.zip/);
    assert.match(cmd, new RegExp(`printf '%s' '${PEPPER}' \\| npx wrangler secret put AUTH_PEPPER`));
    assert.match(cmd, /npx wrangler deploy/);
  });

  it("does not create D1 or R2 or call init-db", () => {
    assert.doesNotMatch(cmd, /wrangler r2 bucket create/);
    assert.doesNotMatch(cmd, /wrangler d1 create/);
    assert.doesNotMatch(cmd, /\/console\/init-db/);
    assert.doesNotMatch(cmd, /node <</);
  });

  it("includes CF_ACCOUNT_ID when provided", () => {
    const withAcct = buildWorkerInstallCommand({
      pepper: PEPPER,
      zipUrl: ZIP,
      accountId: "a".repeat(32),
    });
    assert.match(withAcct, /secret put CF_ACCOUNT_ID/);
    assert.doesNotMatch(withAcct, /# Optional: CF_ACCOUNT_ID/);
  });
});

describe("buildStorageInitCommand", () => {
  const cmd = buildStorageInitCommand({
    pepper: PEPPER,
    workerUrl: "gssisaac",
  });

  it("creates D1 and R2 with the original commands", () => {
    assert.match(cmd, /wrangler r2 bucket create relaybase-mailbox/);
    assert.match(cmd, /wrangler d1 create relaybase-logs/);
    assert.match(cmd, /REPLACE_WITH_\*/);
    assert.match(cmd, /npx wrangler deploy/);
    assert.match(
      cmd,
      /curl -X POST https:\/\/relaybase-api\.gssisaac\.workers\.dev\/console\/init-db/,
    );
  });

  it("does not include download or whoami automation", () => {
    assert.doesNotMatch(cmd, /relaybase-worker-install\.zip/);
    assert.doesNotMatch(cmd, /whoami/);
    assert.doesNotMatch(cmd, /node <</);
  });

  it("keeps the subdomain placeholder until a URL is entered", () => {
    const preview = buildStorageInitCommand({ pepper: PEPPER, workerUrl: "" });
    assert.match(preview, /relaybase-api\.<subdomain>\.workers\.dev/);
  });
});

describe("buildVerifyCommand", () => {
  it("is a single health curl", () => {
    assert.equal(buildVerifyCommand(WORKER), `curl -sf ${WORKER}/health`);
  });
});

describe("workerUpdateCommand", () => {
  it("only downloads and deploys", () => {
    const cmd = workerUpdateCommand(ZIP);
    assert.match(cmd, /wrangler deploy/);
    assert.doesNotMatch(cmd, /init-db/);
    assert.doesNotMatch(cmd, /d1 create/);
  });
});
