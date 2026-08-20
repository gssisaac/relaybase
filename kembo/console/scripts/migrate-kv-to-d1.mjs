import { writeFileSync } from "fs";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const OLD_ACCT = "3adf03d991843094a7343eebc0a98007";
const NEW_ACCT = "674a35f00d9800eec7d6bc42fe55726e";
const NEW_DB = "e759ebf2-f43d-423c-b5e9-163a40432319";
const KEMBO_OPS_NS = "95baa1c7561b4943ae97c0f3c40f6f30";
const KEMBO_LICENSES_NS = "e56178afc7c945ab9cb73b87c851fec4";

const auth = { Authorization: `Bearer ${TOKEN}` };

async function kvGetValue(nsId, key) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${OLD_ACCT}/storage/kv/namespaces/${nsId}/values/${encodeURIComponent(key)}`,
    { headers: auth },
  );
  if (!res.ok) {
    console.error(`KV get failed: ${res.status} ${key}`);
    return null;
  }
  return await res.text();
}

async function kvListKeys(nsId, prefix) {
  const params = new URLSearchParams({ limit: "1000" });
  if (prefix) params.set("prefix", prefix);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${OLD_ACCT}/storage/kv/namespaces/${nsId}/keys?${params}`,
    { headers: auth },
  );
  const data = await res.json();
  return (data.result || []).map((k) => k.name);
}

async function d1Query(sql, params = []) {
  const body = { sql };
  if (params.length) body.params = params;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${NEW_ACCT}/d1/database/${NEW_DB}/query`,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (!data.success) {
    console.error("D1 query failed:", JSON.stringify(data.errors));
  }
  return data;
}

async function main() {
  // 1. Migrate KEMBO_OPS → product_settings
  console.log("=== Migrating KEMBO_OPS → product_settings ===");
  const opsKeys = await kvListKeys(KEMBO_OPS_NS);
  console.log("Keys:", opsKeys);
  for (const key of opsKeys) {
    const parts = key.split(":");
    if (parts.length < 3) continue;
    const serviceId = parts[1];
    const filename = parts.slice(2).join(":");
    const value = await kvGetValue(KEMBO_OPS_NS, key);
    if (!value) continue;
    const now = new Date().toISOString();
    await d1Query(
      "INSERT INTO product_settings (service_id, filename, data, updated_at) VALUES (?, ?, ?, ?)",
      [serviceId, filename, value, now],
    );
    console.log(`  Inserted: ${key}`);
  }

  // 2. Migrate KEMBO_LICENSES → licenses
  console.log("\n=== Migrating KEMBO_LICENSES → licenses ===");
  const licKeys = await kvListKeys(KEMBO_LICENSES_NS, "srv:license:id:");
  console.log("License keys:", licKeys.length);
  for (const key of licKeys) {
    const raw = await kvGetValue(KEMBO_LICENSES_NS, key);
    if (!raw) continue;
    const stored = JSON.parse(raw);
    await d1Query(
      `INSERT INTO licenses (id, email, key_hash, key_prefix, created_at, active, tier, status,
        stripe_session_id, stripe_customer_id, stripe_subscription_id, current_period_end, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stored.id,
        stored.email,
        stored.keyHash,
        stored.keyPrefix,
        stored.createdAt,
        stored.active ? 1 : 0,
        stored.tier,
        stored.status,
        stored.stripeSessionId ?? null,
        stored.stripeCustomerId ?? null,
        stored.stripeSubscriptionId ?? null,
        stored.currentPeriodEnd ?? null,
        stored.note ?? null,
      ],
    );
    console.log(`  Inserted license: ${stored.id}`);
  }

  // 3. Verify
  console.log("\n=== Verify ===");
  const ps = await d1Query("SELECT service_id, filename FROM product_settings");
  console.log("product_settings:", JSON.stringify(ps.result?.[0]?.results || []));
  const lic = await d1Query("SELECT count(*) as count FROM licenses");
  console.log("licenses count:", JSON.stringify(lic.result?.[0]?.results || []));
}

main().catch(console.error);
