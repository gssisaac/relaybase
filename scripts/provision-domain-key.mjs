#!/usr/bin/env node
/**
 * Provision a domain-scoped API key in the relaybase KV namespace.
 * Usage: node scripts/provision-domain-key.mjs macpurity.com macpurity-website
 */
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const API_KEY_PREFIX = "rb_";
const KEY_PREFIX_LENGTH = 8;
const NAMESPACE_ID = "341bf6e6f3c943a8a4f73128a98eb795";

const domain = process.argv[2];
const label = process.argv[3] ?? "default";

if (!domain) {
  console.error("Usage: node scripts/provision-domain-key.mjs <domain> [label]");
  process.exit(1);
}

function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

function keyPrefixFromApiKey(apiKey) {
  const raw = apiKey.startsWith(API_KEY_PREFIX)
    ? apiKey.slice(API_KEY_PREFIX.length)
    : apiKey;
  return raw.slice(0, KEY_PREFIX_LENGTH);
}

const apiKey = generateApiKey();
const keyHash = sha256Hex(apiKey);
const id = crypto.randomUUID();
const createdAt = new Date().toISOString();
const record = {
  id,
  domain: domain.trim().toLowerCase(),
  label,
  keyPrefix: keyPrefixFromApiKey(apiKey),
  createdAt,
  active: true,
  keyHash,
};

const payload = JSON.stringify(record);

for (const key of [`key:${keyHash}`, `id:${id}`]) {
  execSync(
    `npx wrangler kv key put "${key}" '${payload.replace(/'/g, "'\\''")}' --namespace-id=${NAMESPACE_ID} --remote`,
    { stdio: "inherit", cwd: new URL("..", import.meta.url).pathname },
  );
}

console.log(JSON.stringify({ domain: record.domain, label: record.label, apiKey }, null, 2));
