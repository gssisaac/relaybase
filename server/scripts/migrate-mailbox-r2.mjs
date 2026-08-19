#!/usr/bin/env node
/**
 * In-place mailbox layout on the existing R2 bucket.
 *
 * R2 cannot rename buckets. Inbound mail already lives at inbound/{domain}/…,
 * so this script does not copy the bucket. It only:
 *
 *   1. Renames inbound/{domain}/_sent.json → sent/{domain}/_list.json
 *      (same-bucket copy + delete).
 *   2. Writes KV srv:sendlog:* into sent/_sendlog/_index.json +
 *      sent/_sendlog/{id}.json.
 *   3. With --apply, empties and deletes an aborted `relaybase-mailbox`
 *      bucket if one exists (partial copy leftover).
 *
 * Usage (from server/):
 *   node scripts/migrate-mailbox-r2.mjs              # dry-run
 *   node scripts/migrate-mailbox-r2.mjs --apply
 *
 * Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (account id also
 * read from server/wrangler.toml).
 */

import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WRANGLER_TOML = join(__dirname, "..", "wrangler.toml");

const APPLY = process.argv.includes("--apply");
const BUCKET = "relaybase-inbound";
const ABORTED_BUCKET = "relaybase-mailbox";
const KV_NAMESPACE_ID = "341bf6e6f3c943a8a4f73128a98eb795";
const SENDLOG_PREFIX = "srv:sendlog:";
const SENDLOG_INDEX_KEY = "srv:sendlog:_index";
const CONCURRENCY = 6;

function accountIdFromWranglerToml() {
  let text;
  try {
    text = readFileSync(WRANGLER_TOML, "utf8");
  } catch {
    return null;
  }
  const head = text.split(/\n\[\[/)[0];
  const match = head.match(/account_id\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
  accountIdFromWranglerToml() ||
  "";

function wranglerOauthToken() {
  const candidates = [
    join(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
    join(homedir(), ".wrangler/config/default.toml"),
    join(homedir(), ".config/wrangler/default.toml"),
  ];
  for (const path of candidates) {
    try {
      const text = readFileSync(path, "utf8");
      const match = text.match(/oauth_token\s*=\s*"([^"]+)"/);
      if (match?.[1]) return match[1];
    } catch {
      // try next
    }
  }
  return null;
}

function apiToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const oauth = wranglerOauthToken();
  if (oauth) return oauth;
  throw new Error("CLOUDFLARE_API_TOKEN is required (or wrangler login)");
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${apiToken()}`,
    ...extra,
  };
}

function cfApi(path) {
  return `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${path}`;
}

function objectUrl(bucket, key) {
  const encoded = encodeURIComponent(key).replaceAll("%2F", "/");
  return cfApi(`/r2/buckets/${bucket}/objects/${encoded}`);
}

async function cfJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: authHeaders(init.headers),
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  if (!res.ok || body.success === false) {
    const err = body.errors?.[0]?.message || text.slice(0, 300);
    throw new Error(`${init.method || "GET"} ${url} failed (${res.status}): ${err}`);
  }
  return body;
}

async function listBuckets() {
  const listed = await cfJson(cfApi("/r2/buckets"));
  const buckets = listed.result?.buckets ?? listed.result ?? [];
  return Array.isArray(buckets)
    ? buckets.map((b) => (typeof b === "string" ? b : b.name)).filter(Boolean)
    : [];
}

async function listR2Keys(bucket) {
  const keys = [];
  let cursor;
  do {
    const params = new URLSearchParams({ per_page: "1000" });
    if (cursor) params.set("cursor", cursor);
    const body = await cfJson(
      cfApi(`/r2/buckets/${bucket}/objects?${params.toString()}`),
    );
    const objects =
      body.result?.objects ??
      (Array.isArray(body.result) ? body.result : []);
    for (const item of objects) {
      const key = typeof item === "string" ? item : item.key ?? item.name;
      if (key) keys.push(key);
    }
    const info = body.result_info ?? body.result ?? {};
    cursor =
      info.cursor && (info.is_truncated || info.truncated) ? info.cursor : undefined;
    if (!cursor && body.result?.truncated && body.result?.cursor) {
      cursor = body.result.cursor;
    }
  } while (cursor);
  return keys;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function r2Get(bucket, key) {
  const res = await fetch(objectUrl(bucket, key), { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${bucket}/${key} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return {
    contentType: res.headers.get("content-type") || "application/octet-stream",
    body: await res.arrayBuffer(),
  };
}

async function r2Put(bucket, key, body, contentType) {
  const res = await fetch(objectUrl(bucket, key), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": contentType }),
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${bucket}/${key} failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function r2PutJson(key, value) {
  await r2Put(BUCKET, key, JSON.stringify(value), "application/json");
}

async function r2Delete(bucket, key) {
  const res = await fetch(objectUrl(bucket, key), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`DELETE ${bucket}/${key} failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

function destKeyFor(sourceKey) {
  const match = sourceKey.match(/^inbound\/([^/]+)\/_sent\.json$/);
  if (match) return `sent/${match[1]}/_list.json`;
  return null;
}

async function mapPool(items, limit, worker) {
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

async function listKvKeys(prefix) {
  const keys = [];
  let cursor;
  do {
    const params = new URLSearchParams({ prefix, limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const body = await cfJson(
      cfApi(
        `/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?${params.toString()}`,
      ),
    );
    const batch = body.result ?? [];
    for (const item of batch) {
      const name = typeof item === "string" ? item : item.name;
      if (name) keys.push(name);
    }
    cursor = body.result_info?.cursor;
  } while (cursor);
  return keys;
}

async function kvGet(name) {
  const res = await fetch(
    cfApi(
      `/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(name)}`,
    ),
    { headers: authHeaders() },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV GET ${name} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.text();
}

async function renameSentIndexes() {
  console.log(`listing ${BUCKET}…`);
  const keys = await listR2Keys(BUCKET);
  const plan = keys
    .map((from) => ({ from, to: destKeyFor(from) }))
    .filter((row) => row.to);
  console.log(`objects=${keys.length} sent indexes to rename=${plan.length}`);
  for (const row of plan) {
    console.log(`  ${row.from} → ${row.to}`);
  }
  if (!APPLY) {
    console.log(`DRY-RUN would rename ${plan.length} keys in ${BUCKET}`);
    return plan.length;
  }
  for (const row of plan) {
    const object = await r2Get(BUCKET, row.from);
    if (!object) {
      console.log(`  skip missing ${row.from}`);
      continue;
    }
    await r2Put(BUCKET, row.to, object.body, object.contentType);
    await r2Delete(BUCKET, row.from);
    console.log(`  renamed ${row.from} → ${row.to}`);
  }
  return plan.length;
}

async function migrateSendLogs() {
  console.log(`listing KV ${SENDLOG_PREFIX}*…`);
  const keys = await listKvKeys(SENDLOG_PREFIX);
  const indexRaw = await kvGet(SENDLOG_INDEX_KEY);
  let index = [];
  if (indexRaw) {
    try {
      const parsed = JSON.parse(indexRaw);
      if (Array.isArray(parsed)) index = parsed.filter((id) => typeof id === "string");
    } catch {
      index = [];
    }
  }
  const logKeys = keys.filter((name) => name !== SENDLOG_INDEX_KEY);
  if (!index.length) {
    index = logKeys.map((name) => name.slice(SENDLOG_PREFIX.length));
  }
  console.log(`send logs index=${index.length} objects=${logKeys.length}`);
  if (!APPLY) {
    console.log(`DRY-RUN would write sent/_sendlog/* (${index.length} ids)`);
    return index.length;
  }
  await r2PutJson("sent/_sendlog/_index.json", index);
  let written = 0;
  await mapPool(index, CONCURRENCY, async (id) => {
    const raw = await kvGet(`${SENDLOG_PREFIX}${id}`);
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
    await r2PutJson(`sent/_sendlog/${id}.json`, parsed);
    written += 1;
  });
  console.log(`  wrote sent/_sendlog/_index.json + ${written} log objects`);
  return written;
}

async function deleteAbortedMailboxBucket() {
  const names = await listBuckets();
  if (!names.includes(ABORTED_BUCKET)) {
    console.log(`no aborted bucket ${ABORTED_BUCKET}`);
    return;
  }
  const keys = await listR2Keys(ABORTED_BUCKET);
  console.log(`aborted bucket ${ABORTED_BUCKET} objects=${keys.length}`);
  if (!APPLY) {
    console.log(`DRY-RUN would empty + delete ${ABORTED_BUCKET}`);
    return;
  }
  let deleted = 0;
  await mapPool(keys, CONCURRENCY, async (key) => {
    await r2Delete(ABORTED_BUCKET, key);
    deleted += 1;
    if (deleted % 50 === 0 || deleted === keys.length) {
      console.log(`  deleted ${deleted}/${keys.length} from ${ABORTED_BUCKET}`);
    }
  });
  await cfJson(cfApi(`/r2/buckets/${ABORTED_BUCKET}`), { method: "DELETE" });
  console.log(`deleted bucket ${ABORTED_BUCKET}`);
}

async function main() {
  if (!ACCOUNT_ID) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is required (or set account_id in server/wrangler.toml)",
    );
  }
  console.log(
    `${APPLY ? "APPLY" : "DRY-RUN"} in-place on ${BUCKET} (R2 cannot rename buckets)`,
  );
  const renamed = await renameSentIndexes();
  const logCount = await migrateSendLogs();
  await deleteAbortedMailboxBucket();
  console.log(`done renamed=${renamed} sendlogs=${logCount}`);
  if (APPLY) {
    console.log(
      "Next: wrangler deploy bound to relaybase-inbound. KV srv:sendlog:* can stay until you confirm Sent/Logs.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
