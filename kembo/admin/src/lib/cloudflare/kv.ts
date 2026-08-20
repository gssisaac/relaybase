import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { productSettings } from "@/db/schema";

export type Database = ReturnType<typeof getDb>;

export async function getDb(): Promise<ReturnType<typeof drizzle> | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv).DB;
    if (!db) return null;
    return drizzle(db, { schema: { productSettings } });
  } catch {
    return null;
  }
}
