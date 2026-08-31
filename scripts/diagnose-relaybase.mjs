#!/usr/bin/env node
/**
 * Relaybase operator diagnostics — reads admin/.env.local + settings.json,
 * tests Worker health and admin token without printing secrets.
 *
 * Cloudflare credentials live on the product Worker as wrangler secrets
 * (CF_ACCOUNT_ID / CF_API_TOKEN); the admin app no longer holds them, so
 * this script no longer probes the Cloudflare API or R2 list.
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

function resolveInboundR2BucketName(stored) {
  const trimmed = String(stored ?? "").trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === "flare-email-inbound" ||
    trimmed.startsWith("flare-email-inbound-") ||
    trimmed === "relaybase-inbound"
  ) {
    return "relaybase-mailbox";
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

const envFile = loadDotEnv(path.join(root, "hq", "admin", ".env.local"));
const settingsPath = path.join(root, "data", "products", "relaybase", "settings.json");
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
  : {};

const workerUrl = firstNonEmpty(
  envFile.RELAYBASE_URL,
  envFile.FLARE_EMAIL_SENDER_URL,
  settings.workerUrl,
).replace(/\/$/, "");
const adminToken = firstNonEmpty(settings.adminToken);

function printCheck(id, ok, summary, detail) {
  const icon = ok ? "OK" : "FAIL";
  console.log(`[${icon}] ${summary}`);
  if (detail) console.log(`      ${detail}`);
}

console.log("Relaybase diagnostics");
console.log(`Root: ${root}`);
console.log(`Worker: ${workerUrl || "(missing)"}`);
console.log(`Admin token: ${adminToken ? `${adminToken.slice(0, 12)}…` : "(missing)"}`);
console.log("---");

if (!workerUrl) {
  printCheck("worker-url", false, "Worker URL missing", "Set RELAYBASE_URL in admin/.env.local");
  process.exit(1);
}

const healthRes = await fetch(`${workerUrl}/health`);
const health = healthRes.ok ? await healthRes.json() : null;
printCheck(
  "worker-health",
  health?.ok === true,
  health?.ok ? "Worker /health OK" : `Worker /health failed (HTTP ${healthRes.status})`,
);

if (health?.inbound?.bucketName) {
  const mismatch = workerInboundR2BucketMismatch(
    "relaybase-mailbox",
    health.inbound.bucketName,
  );
  printCheck(
    "r2-bucket-match",
    !mismatch,
    mismatch
      ? health.inbound.bucketName.toLowerCase().startsWith("flare-email-inbound")
        ? `Worker still bound to legacy bucket "${health.inbound.bucketName}" — redeploy with relaybase-mailbox`
        : `Bucket mismatch — worker: ${health.inbound.bucketName}, expected: relaybase-mailbox`
      : "Worker bucket matches (relaybase-mailbox)",
    mismatch
      ? "Redeploy worker: server/wrangler.toml bucket_name + INBOUND_BUCKET_NAME = relaybase-mailbox, then npm run deploy --prefix server"
      : undefined,
  );
}

if (adminToken) {
  const adminRes = await fetch(`${workerUrl}/console/keys`, {
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
      : "Set ADMIN_TOKEN on the worker (wrangler secret put ADMIN_TOKEN) and update admin Settings → admin token to match",
  );
} else {
  printCheck(
    "worker-admin-token",
    false,
    "Admin token missing",
    "Set the admin token in admin Settings (must match the worker's ADMIN_TOKEN wrangler secret)",
  );
}

console.log("--- done");
