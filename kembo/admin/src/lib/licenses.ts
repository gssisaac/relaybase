import { eq } from "drizzle-orm";

import { licenses } from "@/db/schema";
import { getDb } from "@/lib/cloudflare/kv";

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

export type ListLicensesResult = {
  licenses: LicenseRecord[];
  available: boolean;
  message?: string;
};

type StoredLicense = LicenseRecord & { keyHash: string };

const D1_UNAVAILABLE =
  "D1 is not available in this environment. Deployed admin reads strum-relaybase-ops.";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

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

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error(D1_UNAVAILABLE);
  }
  return db;
}

export async function listLicenses(): Promise<ListLicensesResult> {
  const db = await getDb();
  if (!db) {
    return { licenses: [], available: false, message: D1_UNAVAILABLE };
  }

  try {
    const rows = await db.select().from(licenses).all();
    const records = rows
      .map(rowToStored)
      .map(storedToRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { licenses: records, available: true };
  } catch {
    return {
      licenses: [],
      available: false,
      message:
        "Could not read licenses from strum-relaybase-ops. Local Next may not have the table; deployed admin reads remote D1.",
    };
  }
}

export async function createLicense(params: {
  email: string;
  note?: string | null;
}): Promise<{ record: LicenseRecord; licenseKey: string }> {
  const db = await requireDb();
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
    tier: "pro" as const,
    stripeSessionId: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    status: "active" as const,
    note: params.note ?? "manual-admin",
  };

  await db.insert(licenses).values(values);

  return {
    record: storedToRecord({
      id: values.id,
      email: values.email,
      keyHash: values.keyHash,
      keyPrefix: values.keyPrefix,
      createdAt: values.createdAt,
      active: true,
      tier: values.tier,
      stripeSessionId: values.stripeSessionId,
      stripeCustomerId: values.stripeCustomerId,
      stripeSubscriptionId: values.stripeSubscriptionId,
      currentPeriodEnd: values.currentPeriodEnd,
      status: values.status,
      note: values.note,
    }),
    licenseKey,
  };
}

export async function revokeLicense(id: string): Promise<boolean> {
  const db = await requireDb();
  const row = await db.select().from(licenses).where(eq(licenses.id, id)).get();
  if (!row) return false;
  await db
    .update(licenses)
    .set({ active: 0, status: "revoked" })
    .where(eq(licenses.id, id));
  return true;
}
