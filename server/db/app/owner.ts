import { eq } from "drizzle-orm";
import type { AppDb } from "./index";
import { ownerConfig } from "./schema";

export type OwnerLoginConfig = {
  ownerEmail: string | null;
  workerUrl: string | null;
  passtokenSalt: string | null;
  passtokenHash: string | null;
  passtokenPrefix: string | null;
  passtokenUpdatedAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
};

export async function getOwnerLoginConfig(
  db: AppDb,
): Promise<OwnerLoginConfig | null> {
  if (!db) return null;
  try {
    const row = await db.select().from(ownerConfig).where(eq(ownerConfig.id, 1)).get();
    if (!row) return null;
    return {
      ownerEmail: row.ownerEmail ?? null,
      workerUrl: row.workerUrl ?? null,
      passtokenSalt: row.passtokenSalt ?? null,
      passtokenHash: row.passtokenHash ?? null,
      passtokenPrefix: row.passtokenPrefix ?? null,
      passtokenUpdatedAt: row.passtokenUpdatedAt ?? null,
      failedAttempts: row.failedAttempts ?? 0,
      lockedUntil: row.lockedUntil ?? null,
    };
  } catch {
    // Pre-0003_owner_login D1s do not have passtoken columns yet. Treat as
    // unconfigured so migrate-db can still run with AUTH_PEPPER bootstrap.
    return null;
  }
}

/** True when an owner passtoken has been issued (login is possible). */
export async function ownerIsConfigured(db: AppDb): Promise<boolean> {
  const cfg = await getOwnerLoginConfig(db);
  return Boolean(cfg?.passtokenHash);
}

export async function setOwnerLogin(
  db: AppDb,
  input: {
    passtokenSalt: string;
    passtokenHash: string;
    passtokenPrefix: string;
  },
): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  await db
    .insert(ownerConfig)
    .values({
      id: 1,
      passtokenSalt: input.passtokenSalt,
      passtokenHash: input.passtokenHash,
      passtokenPrefix: input.passtokenPrefix,
      passtokenUpdatedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .onConflictDoUpdate({
      target: ownerConfig.id,
      set: {
        passtokenSalt: input.passtokenSalt,
        passtokenHash: input.passtokenHash,
        passtokenPrefix: input.passtokenPrefix,
        passtokenUpdatedAt: now,
        failedAttempts: 0,
        lockedUntil: null,
      },
    })
    .run();
}

export async function setOwnerConfig(
  db: AppDb,
  input: { ownerEmail: string; workerUrl: string },
): Promise<void> {
  if (!db) return;
  await db
    .insert(ownerConfig)
    .values({
      id: 1,
      ownerEmail: input.ownerEmail,
      workerUrl: input.workerUrl,
    })
    .onConflictDoUpdate({
      target: ownerConfig.id,
      set: {
        ownerEmail: input.ownerEmail,
        workerUrl: input.workerUrl,
      },
    })
    .run();
}

export async function incrementFailedLogin(
  db: AppDb,
  lockSeconds: number,
): Promise<{ failedAttempts: number; lockedUntil: string | null }> {
  if (!db) return { failedAttempts: 0, lockedUntil: null };
  const row = await db.select().from(ownerConfig).where(eq(ownerConfig.id, 1)).get();
  const next = (row?.failedAttempts ?? 0) + 1;
  const lockedUntil =
    next >= 5 ? new Date(Date.now() + lockSeconds * 1000).toISOString() : null;
  await db
    .update(ownerConfig)
    .set({ failedAttempts: next, lockedUntil })
    .where(eq(ownerConfig.id, 1))
    .run();
  return { failedAttempts: next, lockedUntil };
}

export async function resetFailedLogin(db: AppDb): Promise<void> {
  if (!db) return;
  await db
    .update(ownerConfig)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(ownerConfig.id, 1))
    .run();
}
