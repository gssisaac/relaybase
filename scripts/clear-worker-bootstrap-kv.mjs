#!/usr/bin/env node
/**
 * One-time migration: delete the legacy Worker bootstrap keys
 * `srv:config:cloudflare` and `srv:config:admin` from the product Worker's
 * `RELAYBASE_APP` KV.
 *
 * Background: the ops dashboard (kembo/admin) used to sync Cloudflare
 * credentials and the admin token into Worker KV so the Worker could send
 * mail and authorize admin calls. The Worker now reads these from wrangler
 * secrets (`CF_ACCOUNT_ID`, `CF_API_TOKEN`, `ADMIN_TOKEN`) instead — set via
 * the desktop install flow. The KV keys took precedence over the secrets, so
 * they must be deleted for the secrets to take effect.
 *
 * Prerequisites:
 *   - The product Worker is deployed with the secret-based fallback
 *     (server/src/lib/cloudflare-config.ts, server/src/lib/auth.ts).
 *   - `CF_ACCOUNT_ID`, `CF_API_TOKEN`, and `ADMIN_TOKEN` wrangler secrets are
 *     set on the Worker (run the desktop install or `wrangler secret put`).
 *   - Run from the `server/` directory (where `wrangler.toml` lives) so
 *     `wrangler kv` targets the `RELAYBASE_APP` namespace, OR set
 *     `KV_NAMESPACE_ID` to the namespace id explicitly.
 *
 * Usage:
 *   cd server
 *   node ../scripts/clear-worker-bootstrap-kv.mjs
 *
 *   # or explicitly:
 *   KV_NAMESPACE_ID=341bf6e6f3c943a8a4f73128a98eb795 \
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node scripts/clear-worker-bootstrap-kv.mjs
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const serverDir = path.join(repoRoot, "server");

const KEYS = ["srv:config:cloudflare", "srv:config:admin"];

function runWrangler(args) {
  const cmd = `npx wrangler kv key ${args}`;
  return execSync(cmd, { cwd: serverDir, stdio: "pipe" });
}

function deleteKey(key) {
  try {
    runWrangler(`delete "${key}" --namespace-id=${process.env.KV_NAMESPACE_ID ?? ""} --remote --force`);
    console.log(`  ✓ deleted ${key}`);
    return true;
  } catch (error) {
    const msg = error.stderr?.toString() ?? error.message;
    if (/could not find|not found|does not exist/i.test(msg)) {
      console.log(`  · ${key} already absent — skipped`);
      return true;
    }
    console.error(`  ✗ failed to delete ${key}: ${msg.trim()}`);
    return false;
  }
}

console.log("Clearing legacy Worker bootstrap keys from RELAYBASE_APP KV…");
let allOk = true;
for (const key of KEYS) {
  if (!deleteKey(key)) allOk = false;
}

if (!allOk) {
  console.error(
    "\nOne or more keys could not be deleted. Ensure wrangler is authenticated and the KV namespace id is correct.",
  );
  process.exit(1);
}

console.log(
  "\nDone. The Worker now resolves Cloudflare credentials and the admin token from wrangler secrets.",
);
console.log(
  "Verify with: curl -s <WORKER_URL>/health | jq   (expect cloudflare configured via secrets).",
);
