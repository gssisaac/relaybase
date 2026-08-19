import {
  sha256Hex,
} from "./crypto";

const AUTH_TOKEN_PREFIX = "rb-auth-";
const LEGACY_AUTH_TOKEN_PREFIX = "rb-admin-";
const TOKEN_PREFIX_LENGTH = 8;

export type AuthTokenRecord = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

type StoredAuthTokenRecord = AuthTokenRecord & {
  tokenHash: string;
};

function stripAuthTokenPrefix(token: string): string {
  if (token.startsWith(AUTH_TOKEN_PREFIX)) {
    return token.slice(AUTH_TOKEN_PREFIX.length);
  }
  if (token.startsWith(LEGACY_AUTH_TOKEN_PREFIX)) {
    return token.slice(LEGACY_AUTH_TOKEN_PREFIX.length);
  }
  return token;
}

function authTokenPrefix(token: string): string {
  const stripped = stripAuthTokenPrefix(token);
  return stripped.slice(0, TOKEN_PREFIX_LENGTH);
}

export function isValidAuthTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed.startsWith(AUTH_TOKEN_PREFIX) && !trimmed.startsWith(LEGACY_AUTH_TOKEN_PREFIX)) {
    return false;
  }
  return stripAuthTokenPrefix(trimmed).length > TOKEN_PREFIX_LENGTH;
}

function generateAuthToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${AUTH_TOKEN_PREFIX}${hex}`;
}

function hashKvKey(tokenHash: string): string {
  return `srv:authtoken:hash:${tokenHash}`;
}

function idKvKey(id: string): string {
  return `srv:authtoken:${id}`;
}

const INDEX_KEY = "srv:authtoken:_index";

type IndexEntry = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

async function readIndex(kv: KVNamespace): Promise<IndexEntry[]> {
  const raw = await kv.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as IndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(kv: KVNamespace, entries: IndexEntry[]): Promise<void> {
  await kv.put(INDEX_KEY, JSON.stringify(entries));
}

export async function createAuthToken(
  kv: KVNamespace,
  params: { label?: string | null; productId?: string | null },
): Promise<{ record: AuthTokenRecord; token: string }> {
  const token = generateAuthToken();
  const tokenHash = await sha256Hex(token);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const tokenPrefix = authTokenPrefix(token);

  const record: StoredAuthTokenRecord = {
    id,
    label: params.label?.trim() || null,
    productId: params.productId?.trim() || null,
    tokenPrefix,
    createdAt,
    tokenHash,
  };

  await kv.put(hashKvKey(tokenHash), JSON.stringify(record));
  await kv.put(idKvKey(id), JSON.stringify(record));

  const index = await readIndex(kv);
  const entry: IndexEntry = {
    id,
    label: record.label,
    productId: record.productId,
    tokenPrefix,
    createdAt,
  };
  await writeIndex(kv, [entry, ...index]);

  const { tokenHash: _tokenHash, ...publicRecord } = record;
  return { record: publicRecord, token };
}

export async function listAuthTokens(kv: KVNamespace): Promise<AuthTokenRecord[]> {
  return readIndex(kv);
}

export async function findAuthToken(
  kv: KVNamespace,
  token: string,
): Promise<AuthTokenRecord | null> {
  if (!isValidAuthTokenFormat(token)) return null;
  const tokenHash = await sha256Hex(token.trim());
  const raw = await kv.get(hashKvKey(tokenHash));
  if (!raw) return null;
  const stored = JSON.parse(raw) as StoredAuthTokenRecord;
  const { tokenHash: _tokenHash, ...record } = stored;
  return record;
}

export async function revokeAuthToken(
  kv: KVNamespace,
  id: string,
): Promise<boolean> {
  const raw = await kv.get(idKvKey(id));
  if (!raw) return false;
  const stored = JSON.parse(raw) as StoredAuthTokenRecord;
  await kv.delete(hashKvKey(stored.tokenHash));
  await kv.delete(idKvKey(id));

  const index = await readIndex(kv);
  const next = index.filter((entry) => entry.id !== id);
  if (next.length !== index.length) {
    await writeIndex(kv, next);
  }
  return true;
}
