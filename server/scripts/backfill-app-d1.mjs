#!/usr/bin/env node
/**
 * One-time backfill of the D1 `relaybase-db` (binding RELAYBASE_DB) from the
 * product KV namespace `RELAYBASE_APP` (`srv:*` keys).
 *
 * Run AFTER creating the database and applying migrations:
 *   wrangler d1 create relaybase-db
 *   wrangler d1 migrations apply relaybase-db --remote --migrations-dir=migrations-app
 *   node scripts/backfill-app-d1.mjs            # dry-run (counts only)
 *   node scripts/backfill-app-d1.mjs --apply     # write to D1
 *
 * Options:
 *   --apply            Write rows to D1 (default: dry-run, counts only).
 *   --delete-kv        After backfill, delete migrated + dead KV keys. Implies --apply.
 *   --database-id <id> D1 database id (or D1_DATABASE_ID env, or wrangler.toml).
 *   --kv-id <id>       KV namespace id (or KV_NAMESPACE_ID env, or wrangler.toml).
 *
 * Requires CLOUDFLARE_API_TOKEN (or wrangler login) and CLOUDFLARE_ACCOUNT_ID
 * (or account_id in server/wrangler.toml).
 *
 * Idempotent: uses INSERT OR REPLACE so re-running is safe.
 */

import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, "..");
const WRANGLER_TOML = join(SERVER_DIR, "wrangler.toml");

const API = "https://api.cloudflare.com/client/v4";
const KV_LIST_LIMIT = 1000;
const D1_INSERT_CHUNK = 10; // D1 limits ~100 bound params per query; 10 rows × 8 cols = 80

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function argFlag(name) {
  return process.argv.includes(name);
}

const APPLY = argFlag("--apply");
const DELETE_KV = argFlag("--delete-kv");
const DRY_RUN = !APPLY;

function readWranglerToml() {
  try {
    return readFileSync(WRANGLER_TOML, "utf8");
  } catch {
    return "";
  }
}

function d1DatabaseIdFromToml() {
  const text = readWranglerToml();
  for (const block of text.split(/\n\[\[d1_databases\]\]/)) {
    if (/binding\s*=\s*"RELAYBASE_DB"/.test(block)) {
      const m = block.match(/database_id\s*=\s*"([^"]+)"/);
      if (m && !m[1].startsWith("REPLACE_WITH_")) return m[1];
    }
  }
  return null;
}

function kvNamespaceIdFromToml() {
  const text = readWranglerToml();
  for (const block of text.split(/\n\[\[kv_namespaces\]\]/)) {
    if (/binding\s*=\s*"RELAYBASE_APP"/.test(block)) {
      const m = block.match(/id\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    }
  }
  return null;
}

function accountIdFromToml() {
  const text = readWranglerToml();
  const head = text.split(/\n\[\[/)[0];
  const m = head.match(/account_id\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function wranglerOauthToken() {
  const candidates = [
    join(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
    join(homedir(), ".wrangler/config/default.toml"),
    join(homedir(), ".config/wrangler/default.toml"),
  ];
  for (const file of candidates) {
    try {
      const m = readFileSync(file, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    } catch {}
  }
  return null;
}

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || wranglerOauthToken();
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || accountIdFromToml() || "";
const DATABASE_ID = argValue("--database-id", process.env.D1_DATABASE_ID || "") || d1DatabaseIdFromToml() || "";
const KV_ID = argValue("--kv-id", process.env.KV_NAMESPACE_ID || "") || kvNamespaceIdFromToml() || "";

if (!TOKEN) { console.error("CLOUDFLARE_API_TOKEN is required."); process.exit(1); }
if (!ACCOUNT_ID) { console.error("CLOUDFLARE_ACCOUNT_ID is required."); process.exit(1); }
if (!DATABASE_ID) { console.error("--database-id required (or run from server/)."); process.exit(1); }
if (!KV_ID) { console.error("--kv-id required (or run from server/)."); process.exit(1); }
if (DELETE_KV && !APPLY) { console.error("--delete-kv requires --apply."); process.exit(1); }

const AUTH_HEADERS = { Authorization: `Bearer ${TOKEN}` };

console.log(`Account:  ${ACCOUNT_ID}`);
console.log(`D1:       ${DATABASE_ID}`);
console.log(`KV:       ${KV_ID}`);
console.log(`Mode:     ${DRY_RUN ? "dry-run" : DELETE_KV ? "apply + delete KV" : "apply"}`);
console.log();

// ─── KV helpers ──────────────────────────────────────────────────────────

async function kvListAll() {
  const keys = [];
  let cursor;
  do {
    const url = new URL(`${API}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_ID}/keys`);
    url.searchParams.set("limit", String(KV_LIST_LIMIT));
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) throw new Error(`KV list failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (!data.success) throw new Error(`KV list failed: ${JSON.stringify(data.errors)}`);
    for (const item of data.result ?? []) keys.push(item.name);
    cursor = data.result_info?.cursor;
  } while (cursor);
  return keys.sort();
}

async function kvGet(name) {
  const res = await fetch(
    `${API}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_ID}/values/${encodeURIComponent(name)}`,
    { headers: AUTH_HEADERS },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${name} failed: ${res.status}`);
  return res.text();
}

async function kvDelete(name) {
  const res = await fetch(
    `${API}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_ID}/values/${encodeURIComponent(name)}`,
    { method: "DELETE", headers: AUTH_HEADERS },
  );
  if (!res.ok && res.status !== 404) throw new Error(`KV delete ${name} failed: ${res.status}`);
}

// ─── D1 helpers ──────────────────────────────────────────────────────────

async function d1Query(sql, params = []) {
  const res = await fetch(`${API}/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
    method: "POST",
    headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`D1 query failed: ${res.status} ${JSON.stringify(data.errors ?? data)}`);
  }
  return data;
}

async function d1Count(table) {
  const data = await d1Query(`SELECT COUNT(*) AS c FROM ${table}`);
  return data.result?.[0]?.results?.[0]?.c ?? 0;
}

async function batchInsert(table, columns, rows, placeholders) {
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += D1_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + D1_INSERT_CHUNK);
    const valuesSql = chunk.map(() => placeholders).join(", ");
    await d1Query(`INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES ${valuesSql}`, chunk.flat());
  }
  return rows.length;
}

// ─── utils ───────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();
const normDomain = (s) => s.trim().toLowerCase().replace(/\.$/, "");
const isoOrNow = (v) => v || nowIso();

// ─── per-table backfill (part 1: mailbox, audience, broadcasts, branding) ──

async function backfillMailbox(allKeys) {
  const key = "srv:catalog:mailbox";
  if (!allKeys.includes(key)) { console.log("  mailbox: key not found"); return { domains: 0, addresses: 0 }; }
  const raw = await kvGet(key);
  if (!raw) return { domains: 0, addresses: 0 };
  let data;
  try { data = JSON.parse(raw); } catch { console.warn("  mailbox: invalid JSON"); return { domains: 0, addresses: 0 }; }
  const domainList = Array.isArray(data.domains) ? data.domains : [];
  const addressList = Array.isArray(data.addresses) ? data.addresses : [];
  const domainRows = domainList.map((d) => { const dom = normDomain(String(d)); return [dom, dom, nowIso()]; });
  const addressRows = addressList.map((a) => {
    const email = String(a.email || "").trim().toLowerCase();
    return [email, email, normDomain(String(a.domain || "")), a.displayName || null, a.signature || null, a.inboundEnabled === false ? 0 : 1, a.mobileEnabled === false ? 0 : 1, nowIso()];
  });
  console.log(`  mailbox: ${domainRows.length} domains, ${addressRows.length} addresses`);
  if (DRY_RUN) return { domains: domainRows.length, addresses: addressRows.length };
  const d = await batchInsert("domains", ["id", "domain", "created_at"], domainRows, "(?, ?, ?)");
  const a = await batchInsert("addresses", ["id", "email", "domain", "display_name", "signature", "inbound_enabled", "mobile_enabled", "created_at"], addressRows, "(?, ?, ?, ?, ?, ?, ?, ?)");
  return { domains: d, addresses: a };
}

async function backfillAudience(allKeys) {
  let groupRows = [];
  if (allKeys.includes("srv:catalog:audience-groups")) {
    const raw = await kvGet("srv:catalog:audience-groups");
    if (raw) {
      try {
        const groups = JSON.parse(raw);
        if (Array.isArray(groups)) groupRows = groups.map((g) => [
          g.id, g.name || "", normDomain(String(g.domain || "")), isoOrNow(g.createdAt),
          g.defaultFrom || null, g.dataSource ? JSON.stringify(g.dataSource) : null,
          g.cronEnabled ? 1 : 0, g.cronIntervalMinutes ?? null,
          g.lastSyncAt || null, g.lastSyncStatus || null, g.lastSyncError || null,
          g.lastSyncCount ?? null, g.syncProgress ? JSON.stringify(g.syncProgress) : null,
          g.syncHistory ? JSON.stringify(g.syncHistory) : null,
        ]);
      } catch { console.warn("  audience-groups: invalid JSON"); }
    }
  }
  let contactRows = [];
  if (allKeys.includes("srv:catalog:audience")) {
    const raw = await kvGet("srv:catalog:audience");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const contacts = Array.isArray(parsed) ? parsed : parsed.contacts;
        if (Array.isArray(contacts)) contactRows = contacts.map((c) => [
          c.id || crypto.randomUUID(), String(c.email || "").trim().toLowerCase(),
          c.name || null, normDomain(String(c.domain || "")), c.groupId,
          c.source || "manual", isoOrNow(c.addedAt),
        ]);
      } catch { console.warn("  audience: invalid JSON"); }
    }
  }
  console.log(`  audience: ${groupRows.length} groups, ${contactRows.length} contacts`);
  if (DRY_RUN) return { groups: groupRows.length, contacts: contactRows.length };
  const g = await batchInsert("audience_groups", ["id", "name", "domain", "created_at", "default_from", "data_source_json", "cron_enabled", "cron_interval_minutes", "last_sync_at", "last_sync_status", "last_sync_error", "last_sync_count", "sync_progress_json", "sync_history_json"], groupRows, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const c = await batchInsert("audience_contacts", ["id", "email", "name", "domain", "group_id", "source", "added_at"], contactRows, "(?, ?, ?, ?, ?, ?, ?)");
  return { groups: g, contacts: c };
}

async function backfillBroadcasts(allKeys) {
  const key = "srv:catalog:broadcasts";
  if (!allKeys.includes(key)) { console.log("  broadcasts: key not found"); return { broadcasts: 0 }; }
  const raw = await kvGet(key);
  if (!raw) return { broadcasts: 0 };
  let list;
  try { list = JSON.parse(raw); if (!Array.isArray(list)) list = []; } catch { console.warn("  broadcasts: invalid JSON"); return { broadcasts: 0 }; }
  const rows = list.map((b) => [
    b.id, b.subject || "", b.status || "draft", isoOrNow(b.createdAt),
    normDomain(String(b.domain || "")), JSON.stringify(Array.isArray(b.groupIds) ? b.groupIds : []),
    b.from || null, b.body ?? null, b.recipientCount ?? null, b.sentAt || null,
    b.sendProgress ? JSON.stringify(b.sendProgress) : null, b.sendHistory ? JSON.stringify(b.sendHistory) : null,
  ]);
  console.log(`  broadcasts: ${rows.length} rows`);
  if (DRY_RUN) return { broadcasts: rows.length };
  const count = await batchInsert("broadcasts", ["id", "subject", "status", "created_at", "domain", "group_ids_json", "from_addr", "body", "recipient_count", "sent_at", "send_progress_json", "send_history_json"], rows, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  return { broadcasts: count };
}

async function backfillBranding(allKeys) {
  const key = "srv:catalog:branding";
  if (!allKeys.includes(key)) { console.log("  branding: key not found"); return { branding: 0 }; }
  const raw = await kvGet(key);
  if (!raw) return { branding: 0 };
  let map;
  try { map = JSON.parse(raw); if (typeof map !== "object" || map === null) map = {}; } catch { console.warn("  branding: invalid JSON"); return { branding: 0 }; }
  const rows = Object.entries(map).map(([domain, cfg]) => [normDomain(domain), cfg?.dmarcPolicy || "quarantine", cfg?.dmarcRua || ""]);
  console.log(`  branding: ${rows.length} rows`);
  if (DRY_RUN) return { branding: rows.length };
  const count = await batchInsert("domain_branding", ["domain", "dmarc_policy", "dmarc_rua"], rows, "(?, ?, ?)");
  return { branding: count };
}

// ─── per-table backfill (part 2: keys, tokens, mobile, webhooks) ────────

async function backfillApiKeys(allKeys) {
  const idKeys = allKeys.filter((k) => k.startsWith("srv:id:"));
  const rows = [];
  for (const idKey of idKeys) {
    const raw = await kvGet(idKey);
    if (!raw) continue;
    try {
      const rec = JSON.parse(raw);
      if (rec && rec.id && rec.keyHash) {
        rows.push([rec.id, rec.keyHash, normDomain(String(rec.domain || "")), rec.label || null, rec.keyPrefix || "", isoOrNow(rec.createdAt), rec.active === false ? 0 : 1]);
      }
    } catch { console.warn(`  ${idKey}: invalid JSON`); }
  }
  console.log(`  api_keys: ${rows.length} rows`);
  if (DRY_RUN) return { apiKeys: rows.length };
  const count = await batchInsert("api_keys", ["id", "key_hash", "domain", "label", "key_prefix", "created_at", "active"], rows, "(?, ?, ?, ?, ?, ?, ?)");
  return { apiKeys: count };
}

async function backfillAuthTokens(allKeys) {
  const tokenKeys = allKeys.filter((k) => k.startsWith("srv:authtoken:") && !k.startsWith("srv:authtoken:hash:"));
  const rows = [];
  for (const tk of tokenKeys) {
    const raw = await kvGet(tk);
    if (!raw) continue;
    try {
      const rec = JSON.parse(raw);
      if (rec && rec.id && rec.tokenHash) {
        rows.push([rec.id, rec.tokenHash, rec.label || null, rec.productId || null, rec.tokenPrefix || "", isoOrNow(rec.createdAt)]);
      }
    } catch { console.warn(`  ${tk}: invalid JSON`); }
  }
  console.log(`  auth_tokens: ${rows.length} rows`);
  if (DRY_RUN) return { authTokens: rows.length };
  const count = await batchInsert("auth_tokens", ["id", "token_hash", "label", "product_id", "token_prefix", "created_at"], rows, "(?, ?, ?, ?, ?, ?)");
  return { authTokens: count };
}

async function backfillMobilePasswords(allKeys) {
  const keys = allKeys.filter((k) => k.startsWith("srv:config:mobile:") && k !== "srv:config:mobile");
  const rows = [];
  for (const k of keys) {
    const email = k.slice("srv:config:mobile:".length).toLowerCase();
    const raw = await kvGet(k);
    if (!raw) continue;
    try {
      const cfg = JSON.parse(raw);
      if (cfg && cfg.passwordHash && cfg.salt) {
        rows.push([email, cfg.passwordHash, cfg.salt, isoOrNow(cfg.updatedAt)]);
      }
    } catch { console.warn(`  ${k}: invalid JSON`); }
  }
  console.log(`  mobile_passwords: ${rows.length} rows`);
  if (DRY_RUN) return { mobilePasswords: rows.length };
  const count = await batchInsert("mobile_passwords", ["email", "password_hash", "salt", "updated_at"], rows, "(?, ?, ?, ?)");
  return { mobilePasswords: count };
}

async function backfillWebhooks(allKeys) {
  const hookKeys = allKeys.filter((k) => k.startsWith("srv:webhook:") && !k.startsWith("srv:webhook:secret:") && !k.startsWith("srv:webhook:fail:"));
  const secretKeys = allKeys.filter((k) => k.startsWith("srv:webhook:secret:"));
  const failKeys = allKeys.filter((k) => k.startsWith("srv:webhook:fail:"));
  const hookRows = [];
  for (const hk of hookKeys) {
    const raw = await kvGet(hk);
    if (!raw) continue;
    try {
      const rec = JSON.parse(raw);
      if (rec && rec.id) {
        hookRows.push([rec.id, normDomain(String(rec.domain || "")), rec.url || "", rec.secretHash || "", isoOrNow(rec.createdAt), rec.active === false ? 0 : 1]);
      }
    } catch { console.warn(`  ${hk}: invalid JSON`); }
  }
  const secretRows = [];
  for (const sk of secretKeys) {
    const webhookId = sk.slice("srv:webhook:secret:".length);
    const raw = await kvGet(sk);
    if (!raw) continue;
    secretRows.push([webhookId, raw]);
  }
  const failRows = [];
  for (const fk of failKeys) {
    const raw = await kvGet(fk);
    if (!raw) continue;
    try {
      const rec = JSON.parse(raw);
      if (rec && rec.id) {
        const failedAt = rec.failedAt || nowIso();
        failRows.push([rec.id, rec.webhookId || "", rec.eventId || "", rec.url || "", failedAt, rec.expiresAt || new Date(new Date(failedAt).getTime() + 7 * 86400000).toISOString()]);
      }
    } catch { console.warn(`  ${fk}: invalid JSON`); }
  }
  console.log(`  webhooks: ${hookRows.length} hooks, ${secretRows.length} secrets, ${failRows.length} fails`);
  if (DRY_RUN) return { webhooks: hookRows.length, webhookSecrets: secretRows.length, webhookFails: failRows.length };
  const h = await batchInsert("webhooks", ["id", "domain", "url", "secret_hash", "created_at", "active"], hookRows, "(?, ?, ?, ?, ?, ?)");
  const s = await batchInsert("webhook_secrets", ["webhook_id", "secret"], secretRows, "(?, ?)");
  const f = await batchInsert("webhook_fails", ["id", "webhook_id", "event_id", "url", "failed_at", "expires_at"], failRows, "(?, ?, ?, ?, ?, ?)");
  return { webhooks: h, webhookSecrets: s, webhookFails: f };
}

// ─── per-table backfill (part 3: owner, events) + KV cleanup + main ─────

async function backfillOwnerConfig(allKeys) {
  let ownerEmail = null;
  let workerUrl = null;
  if (allKeys.includes("srv:config:owner:email")) {
    const raw = await kvGet("srv:config:owner:email");
    if (raw) ownerEmail = raw.trim();
  }
  if (allKeys.includes("srv:config:owner:worker_url")) {
    const raw = await kvGet("srv:config:owner:worker_url");
    if (raw) workerUrl = raw.trim();
  }
  if (!ownerEmail && !workerUrl) { console.log("  owner_config: no keys found"); return { ownerConfig: 0 }; }
  console.log(`  owner_config: email=${ownerEmail ? "yes" : "no"} url=${workerUrl ? "yes" : "no"}`);
  if (DRY_RUN) return { ownerConfig: 1 };
  await d1Query("INSERT OR REPLACE INTO owner_config (id, owner_email, worker_url) VALUES (1, ?, ?)", [ownerEmail, workerUrl]);
  return { ownerConfig: 1 };
}

async function backfillInboundEvents(allKeys) {
  const eventKeys = allKeys.filter((k) => k.startsWith("srv:event:pending:"));
  const rows = [];
  for (const ek of eventKeys) {
    const raw = await kvGet(ek);
    if (!raw) continue;
    try {
      const event = JSON.parse(raw);
      if (event && event.id) {
        const createdAt = event.createdAt || nowIso();
        rows.push([event.id, event.data?.domain || "", event.type || "inbound.email.received", createdAt, raw, event.expiresAt || new Date(new Date(createdAt).getTime() + 7 * 86400000).toISOString()]);
      }
    } catch { console.warn(`  ${ek}: invalid JSON`); }
  }
  console.log(`  inbound_events: ${rows.length} rows`);
  if (DRY_RUN) return { inboundEvents: rows.length };
  const count = await batchInsert("inbound_events", ["id", "domain", "event_type", "created_at", "payload_json", "expires_at"], rows, "(?, ?, ?, ?, ?, ?)");
  return { inboundEvents: count };
}

// ─── KV cleanup ─────────────────────────────────────────────────────────

function isMigratedKey(key) {
  if (["srv:catalog:mailbox", "srv:catalog:audience", "srv:catalog:audience-groups", "srv:catalog:broadcasts", "srv:catalog:branding"].includes(key)) return true;
  if (key.startsWith("srv:key:") || key.startsWith("srv:id:") || key.startsWith("srv:authtoken:")) return true;
  if (key.startsWith("srv:config:mobile:") && key !== "srv:config:mobile") return true;
  if (key.startsWith("srv:config:owner:")) return true;
  if (key.startsWith("srv:webhook:") || key.startsWith("srv:event:pending:")) return true;
  return false;
}

function isDeadKey(key) {
  if (["srv:config:admin", "srv:config:cloudflare", "srv:config:mobile"].includes(key)) return true;
  if (key.startsWith("srv:sendlog:")) return true;
  return false;
}

async function deleteKvKeys(allKeys) {
  const toDelete = allKeys.filter((k) => isMigratedKey(k) || isDeadKey(k));
  console.log(`\nDeleting ${toDelete.length} KV keys (migrated + dead)…`);
  for (const k of toDelete) {
    console.log(`  del ${k}`);
    await kvDelete(k);
  }
  return toDelete.length;
}

// ─── main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("Listing KV keys…");
  const allKeys = await kvListAll();
  console.log(`Found ${allKeys.length} KV keys.\n`);

  console.log("Backfilling:");
  const results = {};
  Object.assign(results, await backfillMailbox(allKeys));
  Object.assign(results, await backfillAudience(allKeys));
  Object.assign(results, await backfillBroadcasts(allKeys));
  Object.assign(results, await backfillBranding(allKeys));
  Object.assign(results, await backfillApiKeys(allKeys));
  Object.assign(results, await backfillAuthTokens(allKeys));
  Object.assign(results, await backfillMobilePasswords(allKeys));
  Object.assign(results, await backfillWebhooks(allKeys));
  Object.assign(results, await backfillOwnerConfig(allKeys));
  Object.assign(results, await backfillInboundEvents(allKeys));

  if (DRY_RUN) {
    console.log("\nDry-run complete. Re-run with --apply to write to D1.");
    console.log("After verifying D1 counts, re-run with --apply --delete-kv to clean up KV.");
    return;
  }

  console.log("\nD1 row counts:");
  const tables = ["domains", "addresses", "audience_groups", "audience_contacts", "broadcasts", "domain_branding", "api_keys", "auth_tokens", "mobile_passwords", "webhooks", "webhook_secrets", "webhook_fails", "owner_config", "inbound_events"];
  for (const t of tables) {
    const count = await d1Count(t);
    console.log(`  ${t}: ${count}`);
  }

  if (DELETE_KV) {
    await deleteKvKeys(allKeys);
  } else {
    console.log("\nBackfill complete. Verify D1 counts above, then re-run with --apply --delete-kv to clean up KV.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
