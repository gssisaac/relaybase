import { eq } from "drizzle-orm";
import type { AppDb } from "./index";
import { ownerConfig } from "./schema";

export async function getOwnerConfig(
  db: AppDb,
): Promise<{ ownerEmail: string | null; workerUrl: string | null }> {
  if (!db) return { ownerEmail: null, workerUrl: null };
  const row = await db.select().from(ownerConfig).where(eq(ownerConfig.id, 1)).get();
  return {
    ownerEmail: row?.ownerEmail ?? null,
    workerUrl: row?.workerUrl ?? null,
  };
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
