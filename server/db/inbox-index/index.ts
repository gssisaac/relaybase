import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";

export type InboxIndexDb = ReturnType<typeof createInboxIndexDb>;

/** Build a Drizzle client bound to `RELAYBASE_INBOX_INDEX`. `undefined` → null. */
export function createInboxIndexDb(db: D1Database | undefined) {
  if (!db) return null;
  return drizzle(db, { schema });
}
