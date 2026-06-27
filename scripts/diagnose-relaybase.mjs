#!/usr/bin/env node
/**
 * Relaybase operator diagnostics — reads admin/.env.local + settings.json,
 * tests Cloudflare token, R2 access, and worker sync without printing secrets.
 *
 * Usage: node scripts/diagnose-relaybase.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

const envFile = loadDotEnv(path.join(root, "admin", ".env.local"));
const settingsPath = path.join(root, "data", "products", "relaybase", "settings.json");
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
  : {};

const workerUrl = firstNonEmpty(
  envFile.RELAYBASE_URL,
  envFile.FLARE_EMAIL_SENDER_URL,
  settings.workerUrl,
).replace(/\/$/, "");
const accountId = firstNonEmpty(
  envFile.RELAYBASE_CF_ACCOUNT_ID,
  envFile.FLARE_EMAIL_SENDER_CF_ACCOUNT_ID,
  settings.cloudflareAccountId,
);
const apiToken = firstNonEmpty(
  envFile.RELAYBASE_CF_API_TOKEN,
  envFile.FLARE_EMAIL_SENDER_CF_API_TOKEN,
  settings.cloudflareApiToken,
);
function resolveInboundR2BucketName(stored) {
  const trimmed = String(stored ?? "").trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === "flare-email-inbound" ||
    trimmed.startsWith("flare-email-inbound-")
  ) {
    return "relaybase-inbound";
  }
  return String(stored ?? "").trim();
}

function workerInboundR2BucketMismatch(expected, workerReported) {
  const worker = String(workerReported ?? "").trim();
  if (!worker) return false;
  const resolvedExpected = resolveInboundR2BucketName(expected);
  if (resolveInboundR2BucketName(worker) !== resolvedExpected) return true;
  return worker.toLowerCase() !== resolvedExpected.toLowerCase();
}

const bucketName = resolveInboundR2BucketName(
  firstNonEmpty(
    envFile.RELAYBASE_INBOUND_R2_BUCKET,
    envFile.FLARE_EMAIL_SENDER_INBOUND_R2_BUCKET,
    settings.inboundR2BucketName,
  ),
);
const adminToken = firstNonEmpty(settings.adminToken);

function printCheck(id, ok, summary, detail) {
  const icon = ok ? "OK" : "FAIL";
  console.log(`[${icon}] ${summary}`);
  if (detail) console.log(`      ${detail}`);
}

console.log("Relaybase diagnostics");
console.log(`Root: ${root}`);
console.log(`Worker: ${workerUrl || "(missing)"}`);
console.log(`Account: ${accountId ? `${accountId.slice(0, 8)}…` : "(missing)"}`);
console.log(`R2 bucket target: ${bucketName}`);
console.log(`Admin token: ${adminToken ? `${adminToken.slice(0, 12)}…` : "(missing)"}`);
console.log("---");

if (!accountId || !apiToken) {
  printCheck(
    "cloudflare-configured",
    false,
    "Cloudflare credentials missing",
    "Set RELAYBASE_CF_ACCOUNT_ID and RELAYBASE_CF_API_TOKEN in admin/.env.local",
  );
  process.exit(1);
}

const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
  headers: { Authorization: `Bearer ${apiToken}` },
});
const verifyData = await verifyRes.json();
printCheck(
  "cloudflare-token-valid",
  verifyRes.ok && verifyData.success,
  verifyRes.ok && verifyData.success
    ? `Cloudflare token valid (${verifyData.result?.status ?? "active"})`
    : "Cloudflare token verification failed",
  verifyData.errors?.[0]?.message,
);

const r2Res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets?per_page=10`,
  { headers: { Authorization: `Bearer ${apiToken}` } },
);
const r2Data = await r2Res.json();
const r2Ok = r2Res.ok && r2Data.success;
printCheck(
  "r2-access",
  r2Ok,
  r2Ok ? `R2 API accessible (${(r2Data.result?.buckets ?? []).length} buckets listed)` : "R2 API access failed",
  r2Ok
    ? undefined
    : `${r2Data.errors?.[0]?.message ?? `HTTP ${r2Res.status}`} — create a token with Account → R2 → Edit`,
);

if (workerUrl) {
  const healthRes = await fetch(`${workerUrl}/health`);
  const health = healthRes.ok ? await healthRes.json() : null;
  printCheck(
    "worker-health",
    health?.ok === true,
    health?.ok ? "Worker /health OK" : `Worker /health failed (HTTP ${healthRes.status})`,
  );

  if (health?.inbound?.bucketName) {
    const mismatch = workerInboundR2BucketMismatch(
      bucketName,
      health.inbound.bucketName,
    );
    printCheck(
      "r2-bucket-match",
      !mismatch,
      mismatch
        ? health.inbound.bucketName.toLowerCase().startsWith("flare-email-inbound")
          ? `Worker still bound to legacy bucket "${health.inbound.bucketName}" — redeploy with relaybase-inbound`
          : `Bucket mismatch — worker: ${health.inbound.bucketName}, config: ${bucketName}`
        : `Worker bucket matches (${bucketName})`,
      mismatch
        ? "Redeploy worker: wrangler.toml bucket_name + INBOUND_BUCKET_NAME = relaybase-inbound, then wrangler deploy"
        : undefined,
    );
  }

  if (adminToken) {
    const adminRes = await fetch(`${workerUrl}/admin/keys`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    printCheck(
      "worker-admin-token",
      adminRes.ok,
      adminRes.ok
        ? "Worker accepts stored admin service token"
        : `Worker rejected admin token (HTTP ${adminRes.status})`,
      adminRes.ok
        ? undefined
        : "Click Sync to worker in admin, or bootstrap with CF_API_TOKEN secret",
    );

    const bootstrapRes = await fetch(`${workerUrl}/admin/bootstrap`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const bootstrapData = await bootstrapRes.json().catch(() => ({}));
    const bootstrapAuthOk = bootstrapRes.status !== 401;
    printCheck(
      "worker-bootstrap-auth",
      bootstrapAuthOk,
      bootstrapAuthOk
        ? "Bootstrap auth accepted (CF token matches worker CF_API_TOKEN secret)"
        : `Bootstrap auth rejected (HTTP ${bootstrapRes.status}: ${bootstrapData.error ?? "Unauthorized"})`,
      bootstrapAuthOk
        ? undefined
        : "Run: wrangler secret put CF_API_TOKEN — use the same token as RELAYBASE_CF_API_TOKEN",
    );
  }
} else {
  printCheck("worker-url", false, "Worker URL missing", "Set RELAYBASE_URL in admin/.env.local");
}

console.log("--- done");
