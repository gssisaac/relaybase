#!/usr/bin/env node
/**
 * Ensure Cloudflare OAuth client publisher TXT records exist on relaybase.xyz.
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone → DNS → Edit for relaybase.xyz.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... node scripts/ensure-oauth-publisher-txt.mjs
 */

const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const ZONE_NAME = "relaybase.xyz";

const REQUIRED_TXT = [
  {
    label: "Relaybase Installer",
    content: "cloudflare_oauth_client_publisher=d3fb13d2873de0904c4ccf684d8c1813",
  },
  {
    label: "Relaybase Pass-token Updater",
    content: "cloudflare_oauth_client_publisher=c5bf2cd33d6841e87538a17c9f860a60",
  },
  {
    label: "OAuth client 2310ac59…",
    content: "cloudflare_oauth_client_publisher=80157802eca9fa7f6246a9693f2cde73",
  },
];

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required (Zone DNS Edit on relaybase.xyz).");
  process.exit(1);
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(msg);
  }
  return data;
}

async function main() {
  const zones = await cf(`/zones?name=${ZONE_NAME}`);
  const zone = zones.result?.[0];
  if (!zone) throw new Error(`Zone not found: ${ZONE_NAME}`);

  const records = await cf(`/zones/${zone.id}/dns_records?type=TXT&per_page=100`);
  const existing = new Set(
    (records.result ?? []).map((r) => r.content.replace(/^"|"$/g, "")),
  );

  for (const req of REQUIRED_TXT) {
    if (existing.has(req.content)) {
      console.log(`OK  ${req.label} — TXT already present`);
      continue;
    }

    await cf(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "TXT",
        name: ZONE_NAME,
        content: req.content,
        ttl: 1,
      }),
    });
    console.log(`ADD ${req.label} — TXT created`);
  }

  console.log("\nDone. Cloudflare polls TXT every few minutes; verification may take up to ~48h.");
  console.log("Dashboard: Manage Account → OAuth clients → Restart verification if still pending.");
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
