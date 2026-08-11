import { sha256Hex } from "./crypto";

export type LicenseTier = "free" | "pro";
export type LicenseStatus = "active" | "past_due" | "canceled" | "revoked";

export type LicenseRecord = {
  id: string;
  email: string;
  keyPrefix: string;
  createdAt: string;
  active: boolean;
  tier: LicenseTier;
  stripeSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  status: LicenseStatus;
  note: string | null;
};

type StoredLicense = LicenseRecord & { keyHash: string };

function keyKv(hash: string): string {
  return `srv:license:key:${hash}`;
}

function idKv(id: string): string {
  return `srv:license:id:${id}`;
}

function customerKv(stripeCustomerId: string): string {
  return `srv:license:customer:${stripeCustomerId}`;
}

function emailKv(email: string): string {
  return `srv:license:email:${email.trim().toLowerCase()}`;
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
    tier?: LicenseTier;
    stripeSessionId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: string | null;
    status?: LicenseStatus;
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
    tier: params.tier ?? "pro",
    stripeSessionId: params.stripeSessionId ?? null,
    stripeCustomerId: params.stripeCustomerId ?? null,
    stripeSubscriptionId: params.stripeSubscriptionId ?? null,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    status: params.status ?? "active",
    note: params.note ?? null,
    keyHash,
  };

  await kv.put(keyKv(keyHash), JSON.stringify(stored));
  await kv.put(idKv(id), JSON.stringify(stored));
  if (stored.stripeCustomerId) {
    await kv.put(customerKv(stored.stripeCustomerId), JSON.stringify(stored));
  }
  await kv.put(emailKv(stored.email), JSON.stringify(stored));

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
  const listed = await kv.list({ prefix: "srv:license:id:" });
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
  stored.status = "revoked";
  await kv.put(keyKv(stored.keyHash), JSON.stringify(stored));
  await kv.put(idKv(id), JSON.stringify(stored));
  if (stored.stripeCustomerId) {
    await kv.put(customerKv(stored.stripeCustomerId), JSON.stringify(stored));
  }
  return true;
}

export async function findLicenseByCustomerId(
  kv: KVNamespace,
  stripeCustomerId: string,
): Promise<StoredLicense | null> {
  const raw = await kv.get(customerKv(stripeCustomerId));
  if (!raw) return null;
  return JSON.parse(raw) as StoredLicense;
}

export async function findLicenseByEmail(
  kv: KVNamespace,
  email: string,
): Promise<StoredLicense | null> {
  const raw = await kv.get(emailKv(email));
  if (!raw) return null;
  return JSON.parse(raw) as StoredLicense;
}

export async function updateLicense(
  kv: KVNamespace,
  id: string,
  patch: Partial<Omit<LicenseRecord, "id" | "keyHash">>,
): Promise<LicenseRecord | null> {
  const raw = await kv.get(idKv(id));
  if (!raw) return null;
  const stored = JSON.parse(raw) as StoredLicense;
  const next: StoredLicense = { ...stored, ...patch };
  await kv.put(keyKv(stored.keyHash), JSON.stringify(next));
  await kv.put(idKv(id), JSON.stringify(next));
  if (next.stripeCustomerId && next.stripeCustomerId !== stored.stripeCustomerId) {
    await kv.put(customerKv(next.stripeCustomerId), JSON.stringify(next));
  } else if (next.stripeCustomerId) {
    await kv.put(customerKv(next.stripeCustomerId), JSON.stringify(next));
  }
  const { keyHash: _h, ...record } = next;
  return record;
}
