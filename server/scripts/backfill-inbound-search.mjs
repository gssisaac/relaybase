#!/usr/bin/env node
/**
 * One-time backfill of the D1 FTS5 search index (`inbound_search_fts`) from
 * the R2 inbound store. Run after creating the database and applying
 * migrations (see server/wrangler.toml [[d1_databases]] RELAYBASE_INBOX_INDEX).
 *
 * Usage (from server/):
 *   node scripts/backfill-inbound-search.mjs --database-id <uuid>
 *   node scripts/backfill-inbound-search.mjs --database-id <uuid> --domain wedesk.so
 *
 * Requires CLOUDFLARE_API_TOKEN (or a wrangler login token on this machine)
 * and CLOUDFLARE_ACCOUNT_ID (defaults to server/wrangler.toml's account).
 *
 * Idempotent: each chunk deletes existing rows by id before inserting, so
 * re-running (or racing with live ingest) never duplicates rows.
 */

import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BUCKET = "relaybase-inbound";
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "3adf03d991843094a7343eebc0a98007";
const CONCURRENCY = 6;
/** Rows per INSERT — 18 columns × 5 rows = 90 bound params (D1 limit: 100). */
const INSERT_CHUNK = 5;
/** Cap indexed body text; full bodies stay in R2 meta.json. */
const MAX_BODY_TEXT = 100_000;

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function argValues(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) {
      values.push(process.argv[i + 1]);
    }
  }
  return values;
}

const DATABASE_ID = argValue("--database-id", process.env.D1_DATABASE_ID || "");
const DOMAIN_ARGS = argValues("--domain").map((d) => d.trim().toLowerCase());

function wranglerOauthToken() {
  const candidates = [
    join(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
    join(homedir(), ".wrangler/config/default.toml"),
    join(homedir(), ".config/wrangler/default.toml"),
  ];
  for (const file of candidates) {
    try {
      const text = readFileSync(file, "utf8");
      const match = text.match(/oauth_token\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    } catch {
      // keep looking
    }
  }
  return null;
}

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || wranglerOauthToken();
if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required (or wrangler login)");
  process.exit(1);
}
if (!DATABASE_ID) {
  console.error(
    "--database-id <uuid> is required (the RELAYBASE_INBOX_INDEX D1 database)",
  );
  process.exit(1);
}

const API = "https://api.cloudflare.com/client/v4";
const AUTH_HEADERS = { Authorization: `Bearer ${TOKEN}` };

function objectUrl(key) {
  return `${API}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key).replaceAll("%2F", "/")}`;
}

async function r2GetText(key) {
  const res = await fetch(objectUrl(key), { headers: AUTH_HEADERS });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`R2 GET ${key} failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

async function r2ListDelimitedPrefixes(prefix) {
  const prefixes = [];
  let cursor;
  do {
    const url = new URL(`${API}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects`);
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("delimiter", "/");
    url.searchParams.set("per_page", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) {
      throw new Error(`R2 list failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    for (const p of data.result_info?.delimited_prefixes ?? []) prefixes.push(p);
    cursor = data.result_info?.is_truncated ? data.result_info.cursor : undefined;
  } while (cursor);
  return prefixes;
}

async function d1Query(sql, params = []) {
  const res = await fetch(
    `${API}/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`D1 query failed: ${res.status} ${JSON.stringify(data.errors ?? data)}`);
  }
  return data;
}

function recipientsColumn(meta) {
  const addresses = new Set();
  const add = (value) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) addresses.add(trimmed);
  };
  add(meta.toEmail);
  for (const to of meta.toEmails ?? []) add(to);
  for (const cc of meta.ccEmails ?? []) add(cc);
  return [...addresses].join(",");
}

function joinAddressList(value) {
  return (value ?? []).map((entry) => entry.trim()).filter(Boolean).join(",");
}

function rowParams(meta) {
  return [
    meta.id,
    meta.domain,
    meta.subject ?? "(no subject)",
    meta.fromEmail ?? "",
    meta.fromName ?? null,
    meta.toEmail ?? "",
    joinAddressList(meta.toEmails),
    joinAddressList(meta.ccEmails),
    recipientsColumn(meta),
    (meta.bodyText ?? "").slice(0, MAX_BODY_TEXT),
    meta.bodyPreview ?? "",
    meta.receivedAt,
    meta.messageId ?? null,
    meta.inReplyTo ?? null,
    meta.references ?? null,
    meta.size ?? 0,
    meta.attachments?.length ?? 0,
    // Legacy rows without a readAt key are treated as already read (same
    // rule as normalizeReadState in inbound-store.ts).
    "readAt" in meta ? (meta.readAt ?? null) : meta.receivedAt,
  ];
}

const ROW_COLUMNS = `id, domain, subject, from_email, from_name, to_email, to_emails,
  cc_emails, recipients, body_text, body_preview, received_at, message_id,
  in_reply_to, refs, size, attachment_count, read_at`;
const ROW_PLACEHOLDERS = `(${Array(18).fill("?").join(", ")})`;

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(
    Array(Math.min(limit, items.length)).fill(0).map(() => worker()),
  );
  return results;
}

async function backfillDomain(domain) {
  const listRaw = await r2GetText(`inbound/${domain}/_list.json`);
  if (!listRaw) {
    console.log(`  ${domain}: no _list.json — skipped`);
    return { indexed: 0, missing: 0 };
  }
  const parsed = JSON.parse(listRaw);
  const entries = Array.isArray(parsed.messages) ? parsed.messages : [];
  console.log(`  ${domain}: ${entries.length} messages`);

  let indexed = 0;
  let missing = 0;

  // Load full meta.json per entry (bodyText lives only there).
  const metas = await mapWithConcurrency(entries, CONCURRENCY, async (entry) => {
    const metaRaw = await r2GetText(`inbound/${domain}/${entry.id}/meta.json`);
    if (!metaRaw) {
      missing += 1;
      // Index the compact entry anyway — better subject/from search than
      // nothing (body stays empty).
      return { ...entry, bodyText: "" };
    }
    return JSON.parse(metaRaw);
  });

  for (let i = 0; i < metas.length; i += INSERT_CHUNK) {
    const chunk = metas.slice(i, i + INSERT_CHUNK);
    const ids = chunk.map((meta) => meta.id);
    await d1Query(
      `DELETE FROM inbound_search_fts WHERE id IN (${ids.map(() => "?").join(", ")})`,
      ids,
    );
    await d1Query(
      `INSERT INTO inbound_search_fts (${ROW_COLUMNS}) VALUES ${chunk
        .map(() => ROW_PLACEHOLDERS)
        .join(", ")}`,
      chunk.flatMap((meta) => rowParams(meta)),
    );
    indexed += chunk.length;
    if (indexed % 100 === 0 || indexed === metas.length) {
      process.stdout.write(`\r  ${domain}: indexed ${indexed}/${metas.length}`);
    }
  }
  process.stdout.write("\n");
  return { indexed, missing };
}

async function main() {
  let domains = DOMAIN_ARGS;
  if (domains.length === 0) {
    console.log("Discovering domains under inbound/ …");
    const prefixes = await r2ListDelimitedPrefixes("inbound/");
    domains = prefixes
      .map((p) => p.replace(/^inbound\//, "").replace(/\/$/, ""))
      .filter(Boolean);
  }
  if (domains.length === 0) {
    console.log("No domains found — nothing to backfill.");
    return;
  }
  console.log(`Backfilling ${domains.length} domain(s): ${domains.join(", ")}`);

  let totalIndexed = 0;
  for (const domain of domains) {
    const { indexed, missing } = await backfillDomain(domain);
    totalIndexed += indexed;
    if (missing > 0) {
      console.warn(`  ${domain}: ${missing} entries had no meta.json (indexed without body)`);
    }
  }
  console.log(`Done. Indexed ${totalIndexed} message(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
