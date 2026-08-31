import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof getDb>;

export function getDb(env: { DB?: D1Database }) {
  if (!env.DB) throw new Error("DB binding is not configured");
  return drizzle(env.DB, { schema });
}
