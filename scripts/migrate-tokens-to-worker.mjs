#!/usr/bin/env node
/**
 * One-time migration: move end-user dashboard auth tokens from the legacy
 * operations KV (`product:relaybase:settings.json` → `dashboardAuthTokens`)
 * into the product Worker's `RELAYBASE_APP` KV (`srv:authtoken:*`), and
 * discard the plaintext API key vault (`apiKeyVault`) — the Worker already
 * stores key hashes at `srv:key:*`; plaintext belongs in `~/.relaybase` only.
 *
 * Prerequisites:
 *   - The product Worker is deployed with `/console/auth-tokens` (Phase 3.1).
 *   - `ADMIN_TOKEN` env var matches the Worker's admin bearer token.
 *   - `WORKER_URL` env var points at the deployed product Worker.
 *   - The legacy settings file is reachable at:
 *       repo-root/data/products/relaybase/settings.json   (local FS), or
 *       the KEMBO_OPS KV key `product:relaybase:settings.json` (remote).
 *
 * Behavior:
 *   - Reads `dashboardAuthTokens[]` and `apiKeyVault[]` from the legacy store.
 *   - For each auth token, calls `POST /console/auth-tokens` to re-issue a new
 *     `rb-auth-…` token on the Worker (the legacy plaintext is used only to
 *     identify the record; the new token is printed once for operator relay
 *     to the affected end-user). The legacy plaintext is NOT copied to the
 *     Worker — the Worker mints its own token.
 *   - `apiKeyVault[]` plaintext is discarded silently. Worker `srv:key:*`
 *     hashes already exist for any key issued via `POST /console/keys`.
 *
 * This script is read-only with respect to the legacy store — it does NOT
 * delete `dashboardAuthTokens`/`apiKeyVault` from `settings.json`. Operators
 * should manually remove those fields (or run the follow-up cleanup) after
 * confirming all end-users have received replacement tokens.
 *
 * Usage:
 *   WORKER_URL=https://your-worker.workers.dev \
 *   ADMIN_TOKEN=rb-svc-... \
 *   node scripts/migrate-tokens-to-worker.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const settingsPath = path.join(
  repoRoot,
  "data",
  "products",
  "relaybase",
  "settings.json",
);

const workerUrl = process.env.WORKER_URL?.trim().replace(/\/$/, "");
const adminToken = process.env.ADMIN_TOKEN?.trim();

if (!workerUrl || !adminToken) {
  console.error(
    "WORKER_URL and ADMIN_TOKEN env vars are required (Worker admin bearer).",
  );
  process.exit(1);
}

if (!fs.existsSync(settingsPath)) {
  console.error(`Legacy settings file not found: ${settingsPath}`);
  console.error(
    "If the operator store is remote-only, fetch `product:relaybase:settings.json` from KEMBO_OPS KV and place it at the path above, then re-run.",
  );
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

/** @type {{ id: string; label: string | null; productId: string | null; tokenPrefix: string; token: string; createdAt: string }[]} */
const authTokens = Array.isArray(settings.dashboardAuthTokens)
  ? settings.dashboardAuthTokens
  : [];
/** @type {unknown[]} */
const apiKeyVault = Array.isArray(settings.apiKeyVault)
  ? settings.apiKeyVault
  : [];

console.log(
  `Legacy store: ${authTokens.length} auth token(s), ${apiKeyVault.length} vault key(s).`,
);

if (authTokens.length === 0 && apiKeyVault.length === 0) {
  console.log("Nothing to migrate.");
  process.exit(0);
}

let issued = 0;
let failed = 0;
const newTokens = [];

for (const entry of authTokens) {
  try {
    const res = await fetch(`${workerUrl}/console/auth-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        label: entry.label,
        productId: entry.productId,
      }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({})));
    if (!res.ok || !data.token) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    issued += 1;
    newTokens.push({
      oldId: entry.id,
      oldLabel: entry.label,
      productId: entry.productId,
      newToken: data.token,
    });
  } catch (error) {
    failed += 1;
    console.error(
      `  ✗ failed to re-issue token for "${entry.label ?? entry.id}":`,
      error instanceof Error ? error.message : error,
    );
  }
}

console.log(`\nRe-issued ${issued} auth token(s) on the Worker; ${failed} failure(s).`);
if (newTokens.length) {
  console.log("\nNew tokens (relay each to the affected end-user — shown once):");
  for (const t of newTokens) {
    console.log(
      `  ${t.oldLabel ?? t.oldId} (productId=${t.productId ?? "—"}): ${t.newToken}`,
    );
  }
}

if (apiKeyVault.length) {
  console.log(
    `\nDiscarding ${apiKeyVault.length} plaintext vault key(s) — Worker srv:key:* hashes remain authoritative. No action needed; the legacy settings.json still holds the plaintext until manually cleaned.`,
  );
}

console.log(
  "\nNext step: confirm end-users have received replacement tokens, then edit",
  settingsPath,
  "to remove `dashboardAuthTokens` and `apiKeyVault` fields (or run the cleanup step).",
);
