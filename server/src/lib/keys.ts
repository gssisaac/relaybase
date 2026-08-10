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
  return `srv:key:${keyHash}`;
}

function idKvKey(id: string): string {
  return `srv:id:${id}`;
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
  const listed = await kv.list({ prefix: "srv:id:" });
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

export async function revokeKey(kv: KVNamespace, id: string): Promise<boolean> {
  const raw = await kv.get(idKvKey(id));
  if (!raw) return false;

  const stored = JSON.parse(raw) as StoredKeyRecord;
  await kv.delete(keyKvKey(stored.keyHash));
  await kv.delete(idKvKey(id));
  return true;
}

export async function setKeyActive(
  kv: KVNamespace,
  id: string,
  active: boolean,
): Promise<KeyRecord | null> {
  const raw = await kv.get(idKvKey(id));
  if (!raw) return null;

  const stored = JSON.parse(raw) as StoredKeyRecord;
  stored.active = active;
  await kv.put(keyKvKey(stored.keyHash), JSON.stringify(stored));
  await kv.put(idKvKey(id), JSON.stringify(stored));
  const { keyHash: _keyHash, ...record } = stored;
  return record;
}

export async function rotateKey(
  kv: KVNamespace,
  id: string,
): Promise<{ record: KeyRecord; apiKey: string } | null> {
  const raw = await kv.get(idKvKey(id));
  if (!raw) return null;

  const previous = JSON.parse(raw) as StoredKeyRecord;
  await kv.delete(keyKvKey(previous.keyHash));
  await kv.delete(idKvKey(id));

  const apiKey = generateApiKey();
  const keyHash = await sha256Hex(apiKey);
  const keyPrefix = keyPrefixFromApiKey(apiKey);
  const stored: StoredKeyRecord = {
    ...previous,
    keyPrefix,
    keyHash,
    active: true,
  };
  await kv.put(keyKvKey(keyHash), JSON.stringify(stored));
  await kv.put(idKvKey(id), JSON.stringify(stored));
  const { keyHash: _keyHash, ...record } = stored;
  return { record, apiKey };
}
