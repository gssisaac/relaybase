import { sha256Hex } from "./crypto";

export type LicenseRecord = {
  id: string;
  email: string;
  keyPrefix: string;
  createdAt: string;
  active: boolean;
  stripeSessionId: string | null;
  note: string | null;
};

type StoredLicense = LicenseRecord & { keyHash: string };

function keyKv(hash: string): string {
  return `license:key:${hash}`;
}

function idKv(id: string): string {
  return `license:id:${id}`;
}

export function generateLicenseKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `rb_lic_${body}`;
}

export async function createLicense(
  kv: KVNamespace,
  params: {
    email: string;
    stripeSessionId?: string | null;
    note?: string | null;
  },
): Promise<{ record: LicenseRecord; licenseKey: string }> {
  const licenseKey = generateLicenseKey();
  const keyHash = await sha256Hex(licenseKey);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const keyPrefix = licenseKey.slice(0, 14);

  const stored: StoredLicense = {
    id,
    email: params.email.trim().toLowerCase(),
    keyPrefix,
    createdAt,
    active: true,
    stripeSessionId: params.stripeSessionId ?? null,
    note: params.note ?? null,
    keyHash,
  };

  await kv.put(keyKv(keyHash), JSON.stringify(stored));
  await kv.put(idKv(id), JSON.stringify(stored));

  const { keyHash: _h, ...record } = stored;
  return { record, licenseKey };
}

export async function verifyLicense(
  kv: KVNamespace,
  licenseKey: string,
): Promise<LicenseRecord | null> {
  const trimmed = licenseKey.trim();
  if (!trimmed.startsWith("rb_lic_")) return null;
  const keyHash = await sha256Hex(trimmed);
  const raw = await kv.get(keyKv(keyHash));
  if (!raw) return null;
  const stored = JSON.parse(raw) as StoredLicense;
  if (!stored.active) return null;
  const { keyHash: _h, ...record } = stored;
  return record;
}

export async function listLicenses(kv: KVNamespace): Promise<LicenseRecord[]> {
  const listed = await kv.list({ prefix: "license:id:" });
  const out: LicenseRecord[] = [];
  for (const item of listed.keys) {
    const raw = await kv.get(item.name);
    if (!raw) continue;
    const stored = JSON.parse(raw) as StoredLicense;
    const { keyHash: _h, ...record } = stored;
    out.push(record);
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export async function revokeLicense(
  kv: KVNamespace,
  id: string,
): Promise<boolean> {
  const raw = await kv.get(idKv(id));
  if (!raw) return false;
  const stored = JSON.parse(raw) as StoredLicense;
  stored.active = false;
  await kv.put(keyKv(stored.keyHash), JSON.stringify(stored));
  await kv.put(idKv(id), JSON.stringify(stored));
  return true;
}
