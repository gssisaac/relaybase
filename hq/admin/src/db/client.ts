import { drizzle } from "drizzle-orm/d1";
import { betaInvites, licenses, productSettings } from "./schema";

export type Database = ReturnType<typeof getDb>;

export function getDb(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema: { productSettings, betaInvites, licenses } });
}
