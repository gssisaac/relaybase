import { eq } from "drizzle-orm";
import { sha256Hex } from "./crypto";
import { licenses } from "@/db/schema";
import type { Database } from "@/db/client";

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

export function generateLicenseKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `rb_lic_${body}`;
}

function rowToStored(row: typeof licenses.$inferSelect): StoredLicense {
  return {
    id: row.id,
    email: row.email,
    keyHash: row.keyHash,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt,
    active: row.active === 1,
    tier: row.tier as LicenseTier,
    stripeSessionId: row.stripeSessionId,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    currentPeriodEnd: row.currentPeriodEnd,
    status: row.status as LicenseStatus,
    note: row.note,
  };
}

function storedToRecord(stored: StoredLicense): LicenseRecord {
  const { keyHash: _h, ...record } = stored;
  return record;
}

export async function createLicense(
  db: Database,
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

  const values = {
    id,
    email: params.email.trim().toLowerCase(),
    keyHash,
    keyPrefix,
    createdAt,
    active: 1,
    tier: params.tier ?? "pro",
    stripeSessionId: params.stripeSessionId ?? null,
    stripeCustomerId: params.stripeCustomerId ?? null,
    stripeSubscriptionId: params.stripeSubscriptionId ?? null,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    status: params.status ?? "active",
    note: params.note ?? null,
  };

  await db.insert(licenses).values(values);

  const stored: StoredLicense = {
    id: values.id,
    email: values.email,
    keyHash: values.keyHash,
    keyPrefix: values.keyPrefix,
    createdAt: values.createdAt,
    active: true,
    tier: values.tier as LicenseTier,
    stripeSessionId: values.stripeSessionId,
    stripeCustomerId: values.stripeCustomerId,
    stripeSubscriptionId: values.stripeSubscriptionId,
    currentPeriodEnd: values.currentPeriodEnd,
    status: values.status as LicenseStatus,
    note: values.note,
  };
  return { record: storedToRecord(stored), licenseKey };
}

export async function verifyLicense(
  db: Database,
  licenseKey: string,
): Promise<LicenseRecord | null> {
  const trimmed = licenseKey.trim();
  if (!trimmed.startsWith("rb_lic_")) return null;
  const keyHash = await sha256Hex(trimmed);
  const row = await db.select().from(licenses).where(eq(licenses.keyHash, keyHash)).get();
  if (!row) return null;
  const stored = rowToStored(row);
  if (!stored.active) return null;
  return storedToRecord(stored);
}

export async function listLicenses(db: Database): Promise<LicenseRecord[]> {
  const rows = await db.select().from(licenses).all();
  const out = rows.map(rowToStored).map(storedToRecord);
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export async function revokeLicense(
  db: Database,
  id: string,
): Promise<boolean> {
  const row = await db.select().from(licenses).where(eq(licenses.id, id)).get();
  if (!row) return false;
  await db
    .update(licenses)
    .set({ active: 0, status: "revoked" })
    .where(eq(licenses.id, id));
  return true;
}

export async function findLicenseByCustomerId(
  db: Database,
  stripeCustomerId: string,
): Promise<StoredLicense | null> {
  const row = await db
    .select()
    .from(licenses)
    .where(eq(licenses.stripeCustomerId, stripeCustomerId))
    .get();
  return row ? rowToStored(row) : null;
}

export async function findLicenseByEmail(
  db: Database,
  email: string,
): Promise<StoredLicense | null> {
  const row = await db
    .select()
    .from(licenses)
    .where(eq(licenses.email, email.trim().toLowerCase()))
    .get();
  return row ? rowToStored(row) : null;
}

export async function updateLicense(
  db: Database,
  id: string,
  patch: Partial<Omit<LicenseRecord, "id" | "keyHash">>,
): Promise<LicenseRecord | null> {
  const row = await db.select().from(licenses).where(eq(licenses.id, id)).get();
  if (!row) return null;
  const update: Partial<typeof licenses.$inferInsert> = {};
  if (patch.email !== undefined) update.email = patch.email.trim().toLowerCase();
  if (patch.active !== undefined) update.active = patch.active ? 1 : 0;
  if (patch.tier !== undefined) update.tier = patch.tier;
  if (patch.stripeSessionId !== undefined) update.stripeSessionId = patch.stripeSessionId;
  if (patch.stripeCustomerId !== undefined) update.stripeCustomerId = patch.stripeCustomerId;
  if (patch.stripeSubscriptionId !== undefined) update.stripeSubscriptionId = patch.stripeSubscriptionId;
  if (patch.currentPeriodEnd !== undefined) update.currentPeriodEnd = patch.currentPeriodEnd;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.note !== undefined) update.note = patch.note;

  if (Object.keys(update).length > 0) {
    await db.update(licenses).set(update).where(eq(licenses.id, id));
  }

  const updated = await db.select().from(licenses).where(eq(licenses.id, id)).get();
  if (!updated) return null;
  return storedToRecord(rowToStored(updated));
}
