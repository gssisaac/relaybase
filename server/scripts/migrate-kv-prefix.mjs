#!/usr/bin/env node
/**
 * One-time migration: prefix every legacy KEYS namespace entry with `srv:`.
 *
 * Namespace id (was KEYS, now RELAYBASE_APP):
 *   341bf6e6f3c943a8a4f73128a98eb795
 *
 * Mapping:
 *   config:admin       → srv:config:admin
 *   config:cloudflare  → srv:config:cloudflare
 *   config:mailbox     → srv:catalog:mailbox
 *   key:{hash}         → srv:key:{hash}
 *   id:{uuid}          → srv:id:{uuid}
 *   license:*          → srv:license:*
 *   sendlog:*          → srv:sendlog:*
 *   event:pending:*    → srv:event:pending:*
 *   webhook:*          → srv:webhook:*
 *
 * Usage (from server/):
 *   node scripts/migrate-kv-prefix.mjs           # dry-run
 *   node scripts/migrate-kv-prefix.mjs --apply   # write + delete old keys
 *
 * Requires CLOUDFLARE_API_TOKEN (or wrangler login) and wrangler on PATH.
 */

import { execFileSync } from "node:child_process";

const NAMESPACE_ID = "341bf6e6f3c943a8a4f73128a98eb795";
const APPLY = process.argv.includes("--apply");

function mapKey(name) {
  if (name.startsWith("srv:")) return null; // already migrated
  if (name === "config:mailbox") return "srv:catalog:mailbox";
  if (name.startsWith("config:")) return `srv:${name}`;
  if (name.startsWith("key:")) return `srv:${name}`;
  if (name.startsWith("id:")) return `srv:${name}`;
  if (name.startsWith("license:")) return `srv:${name}`;
  if (name.startsWith("sendlog:")) return `srv:${name}`;
  if (name.startsWith("event:pending:")) return `srv:${name}`;
  if (name.startsWith("webhook:")) return `srv:${name}`;
  return null;
}

function wrangler(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function listAllKeys() {
  const keys = [];
  let cursor;
  do {
    const args = [
      "kv",
      "key",
      "list",
      `--namespace-id=${NAMESPACE_ID}`,
      "--remote",
    ];
    if (cursor) args.push(`--cursor=${cursor}`);
    const out = wrangler(args);
    const parsed = JSON.parse(out);
    const batch = Array.isArray(parsed) ? parsed : parsed.keys ?? [];
    for (const item of batch) {
      keys.push(typeof item === "string" ? item : item.name);
    }
    cursor = Array.isArray(parsed) ? undefined : parsed.cursor;
  } while (cursor);
  return keys;
}

function getValue(name) {
  return wrangler([
    "kv",
    "key",
    "get",
    name,
    `--namespace-id=${NAMESPACE_ID}`,
    "--remote",
  ]);
}

function putValue(name, value) {
  wrangler([
    "kv",
    "key",
    "put",
    name,
    value,
    `--namespace-id=${NAMESPACE_ID}`,
    "--remote",
  ]);
}

function deleteKey(name) {
  wrangler([
    "kv",
    "key",
    "delete",
    name,
    `--namespace-id=${NAMESPACE_ID}`,
    "--remote",
  ]);
}

const all = listAllKeys();
const plan = [];
for (const name of all) {
  const next = mapKey(name);
  if (!next) continue;
  plan.push({ from: name, to: next });
}

console.log(
  APPLY
    ? `Applying ${plan.length} renames…`
    : `Dry-run: ${plan.length} keys would be renamed (pass --apply to write)`,
);
for (const { from, to } of plan) {
  console.log(`  ${from} → ${to}`);
  if (!APPLY) continue;
  const value = getValue(from);
  putValue(to, value);
  deleteKey(from);
}

if (!APPLY) {
  console.log("\nRe-run with --apply to migrate.");
  process.exit(0);
}

console.log(`Done. Migrated ${plan.length} keys.`);
