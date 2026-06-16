import type { Env } from "../env";
import { CloudflareClient } from "./cloudflare-client";
import {
  generateApiKey,
  isValidApiKeyFormat,
  isValidDomain,
  keyPrefixFromApiKey,
  sha256Hex,
} from "./crypto";

export type KeyRecord = {
  id: string;
  domain: string;
  label: string | null;
  keyPrefix: string;
  createdAt: string;
  active: boolean;
};

type StoredKeyRecord = KeyRecord & {
  keyHash: string;
};

function keyKvKey(keyHash: string): string {
  return `key:${keyHash}`;
}

function idKvKey(id: string): string {
  return `id:${id}`;
}

export async function createKey(
  kv: KVNamespace,
  params: { domain: string; label?: string | null },
): Promise<{ record: KeyRecord; apiKey: string }> {
  const domain = params.domain.trim().toLowerCase();
  if (!isValidDomain(domain)) {
    throw new Error("domain must be a valid hostname (e.g. example.com)");
  }

  const apiKey = generateApiKey();
  const keyHash = await sha256Hex(apiKey);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const keyPrefix = keyPrefixFromApiKey(apiKey);

  const record: StoredKeyRecord = {
    id,
    domain,
    label: params.label?.trim() || null,
    keyPrefix,
    createdAt,
    active: true,
    keyHash,
  };

  await kv.put(keyKvKey(keyHash), JSON.stringify(record));
  await kv.put(idKvKey(id), JSON.stringify(record));

  const { keyHash: _keyHash, ...publicRecord } = record;
  return { record: publicRecord, apiKey };
}

export async function listKeys(kv: KVNamespace): Promise<KeyRecord[]> {
  const listed = await kv.list({ prefix: "id:" });
  const keys: KeyRecord[] = [];

  for (const item of listed.keys) {
    const raw = await kv.get(item.name);
    if (!raw) continue;
    const stored = JSON.parse(raw) as StoredKeyRecord;
    const { keyHash: _keyHash, ...record } = stored;
    keys.push(record);
  }

  keys.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return keys;
}

export async function resolveKey(
  kv: KVNamespace,
  apiKey: string,
): Promise<KeyRecord | null> {
  if (!isValidApiKeyFormat(apiKey)) return null;

  const keyHash = await sha256Hex(apiKey);
  const raw = await kv.get(keyKvKey(keyHash));
  if (!raw) return null;

  const stored = JSON.parse(raw) as StoredKeyRecord;
  if (!stored.active) return null;

  const { keyHash: _keyHash, ...record } = stored;
  return record;
}

export function createCloudflareClient(env: Env): CloudflareClient {
  return new CloudflareClient({
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.CF_API_TOKEN,
  });
}
