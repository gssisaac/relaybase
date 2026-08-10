import { sha256Hex } from "./crypto.ts";

/**
 * Mobile access password stored in Worker KV under `srv:config:mobile`.
 *
 * The desktop app generates a password, shows it once, and writes a salted
 * SHA-256 hash here. The Flutter app sends the plain password as a Bearer
 * token to `/mobile/*`; the Worker re-hashes with the stored salt and
 * compares in constant time. The plain password is never persisted.
 */

export const MOBILE_CONFIG_KV_KEY = "srv:config:mobile";

/**
 * Per-account mobile password stored in Worker KV under
 * `srv:config:mobile:{email}`. The desktop Other device tab generates a
 * password per address, shows it once, and writes a salted SHA-256 hash here.
 * The Flutter app sends the plain password as a Bearer token plus the
 * account email via `X-Account-Email`; the Worker re-hashes with the stored
 * salt and compares in constant time. The plain password is never persisted.
 */
export const accountMobileConfigKey = (email: string): string =>
  `${MOBILE_CONFIG_KV_KEY}:${email.trim().toLowerCase()}`;

export type MobileConfig = {
  /** Salted SHA-256 hex of the plain password. */
  passwordHash: string;
  /** Per-install random salt (hex). */
  salt: string;
  /** ISO timestamp of the last set/regenerate. */
  updatedAt: string;
};

/** Shape persisted in KV (always enabled when present). */
export type StoredMobileConfig = MobileConfig;

export type MobileConfigPublicView = {
  enabled: boolean;
  updatedAt: string | null;
};

/** Per-account public status (no plain password). */
export type AccountMobileConfigPublicView = {
  hasPassword: boolean;
  updatedAt: string | null;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** Character pool for human-friendly account passwords. */
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Generate a new plain mobile password — a 12-character human-friendly
 * alphanumeric string (no ambiguous chars like O/0/1/l), like a normal
 * account password rather than a long opaque token.
 */
export function generateMobilePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += PASSWORD_ALPHABET[bytes[i]! % PASSWORD_ALPHABET.length];
  }
  return out;
}

/** Generate a new per-install salt. */
export function generateMobileSalt(): string {
  return randomHex(16);
}

/** Salted SHA-256 hex of the plain password. */
export async function hashMobilePassword(
  password: string,
  salt: string,
): Promise<string> {
  return sha256Hex(`${salt}:${password.trim()}`);
}

/** Constant-time string equality. Returns false for different lengths. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function getMobileConfig(
  kv: KVNamespace,
): Promise<StoredMobileConfig | null> {
  const raw = await kv.get(MOBILE_CONFIG_KV_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMobileConfig>;
    if (
      typeof parsed.passwordHash !== "string" ||
      typeof parsed.salt !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      passwordHash: parsed.passwordHash,
      salt: parsed.salt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function setMobileConfig(
  kv: KVNamespace,
  config: StoredMobileConfig,
): Promise<void> {
  await kv.put(MOBILE_CONFIG_KV_KEY, JSON.stringify(config));
}

export async function clearMobileConfig(kv: KVNamespace): Promise<void> {
  await kv.delete(MOBILE_CONFIG_KV_KEY);
}

/** Create a fresh password + salt + hash and persist. Returns the plain password. */
export async function rotateMobileConfig(
  kv: KVNamespace,
): Promise<{ password: string; config: StoredMobileConfig }> {
  const password = generateMobilePassword();
  const salt = generateMobileSalt();
  const passwordHash = await hashMobilePassword(password, salt);
  const config: StoredMobileConfig = {
    passwordHash,
    salt,
    updatedAt: new Date().toISOString(),
  };
  await setMobileConfig(kv, config);
  return { password, config };
}

export function toMobileConfigPublicView(
  config: StoredMobileConfig | null,
): MobileConfigPublicView {
  return config
    ? { enabled: true, updatedAt: config.updatedAt }
    : { enabled: false, updatedAt: null };
}

// ---- Per-account mobile password ----

export async function getAccountMobileConfig(
  kv: KVNamespace,
  email: string,
): Promise<StoredMobileConfig | null> {
  const raw = await kv.get(accountMobileConfigKey(email));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMobileConfig>;
    if (
      typeof parsed.passwordHash !== "string" ||
      typeof parsed.salt !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      passwordHash: parsed.passwordHash,
      salt: parsed.salt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function setAccountMobileConfig(
  kv: KVNamespace,
  email: string,
  config: StoredMobileConfig,
): Promise<void> {
  await kv.put(accountMobileConfigKey(email), JSON.stringify(config));
}

export async function clearAccountMobileConfig(
  kv: KVNamespace,
  email: string,
): Promise<void> {
  await kv.delete(accountMobileConfigKey(email));
}

/** Create a fresh per-account password + salt + hash and persist. Returns the plain password. */
export async function rotateAccountMobileConfig(
  kv: KVNamespace,
  email: string,
): Promise<{ password: string; config: StoredMobileConfig }> {
  const password = generateMobilePassword();
  const salt = generateMobileSalt();
  const passwordHash = await hashMobilePassword(password, salt);
  const config: StoredMobileConfig = {
    passwordHash,
    salt,
    updatedAt: new Date().toISOString(),
  };
  await setAccountMobileConfig(kv, email, config);
  return { password, config };
}

export function toAccountMobileConfigPublicView(
  config: StoredMobileConfig | null,
): AccountMobileConfigPublicView {
  return config
    ? { hasPassword: true, updatedAt: config.updatedAt }
    : { hasPassword: false, updatedAt: null };
}
