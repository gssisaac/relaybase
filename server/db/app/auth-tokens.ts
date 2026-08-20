import { desc, eq } from "drizzle-orm";
import type { AppDb } from "./index";
import { authTokens, type AuthTokenRow } from "./schema";
import type { AuthTokenRecord } from "../../src/lib/auth-tokens";

function rowToRecord(row: AuthTokenRow): AuthTokenRecord {
  return {
    id: row.id,
    label: row.label,
    productId: row.productId,
    tokenPrefix: row.tokenPrefix,
    createdAt: row.createdAt,
  };
}

export async function createAuthTokenRow(
  db: AppDb,
  input: {
    id: string;
    tokenHash: string;
    label: string | null;
    productId: string | null;
    tokenPrefix: string;
  },
): Promise<void> {
  if (!db) return;
  await db
    .insert(authTokens)
    .values({
      id: input.id,
      tokenHash: input.tokenHash,
      label: input.label,
      productId: input.productId,
      tokenPrefix: input.tokenPrefix,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export async function findAuthTokenByHash(
  db: AppDb,
  tokenHash: string,
): Promise<AuthTokenRecord | null> {
  if (!db) return null;
  const row = await db
    .select()
    .from(authTokens)
    .where(eq(authTokens.tokenHash, tokenHash))
    .get();
  return row ? rowToRecord(row) : null;
}

export async function listAuthTokens(db: AppDb): Promise<AuthTokenRecord[]> {
  if (!db) return [];
  const rows = await db.select().from(authTokens).orderBy(desc(authTokens.createdAt)).all();
  return rows.map(rowToRecord);
}

export async function revokeAuthTokenRow(
  db: AppDb,
  id: string,
): Promise<boolean> {
  if (!db) return false;
  const result = await db.delete(authTokens).where(eq(authTokens.id, id)).run();
  return result.meta.changes > 0;
}
