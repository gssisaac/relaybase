import type { StudioDataStore } from "@db/types";
import { persistStudioDataStore } from "@lib/orm/postgres-persist";

let cache: StudioDataStore | null = null;
let persistChain: Promise<void> = Promise.resolve();

export function getPostgresStoreCache(): StudioDataStore | null {
  return cache;
}

export function setPostgresStoreCache(next: StudioDataStore): void {
  cache = next;
}

export function readPostgresStoreClone(): StudioDataStore {
  if (!cache) {
    throw new Error("PostgreSQL store cache is not initialized");
  }
  return structuredClone(cache);
}

export function commitPostgresStoreCache(next: StudioDataStore): StudioDataStore {
  cache = next;
  persistChain = persistChain
    .then(() => persistStudioDataStore(next))
    .catch((err) => {
      console.error("[store] PostgreSQL persist failed:", err);
      throw err;
    });
  return structuredClone(next);
}

export async function flushPostgresStorePersist(): Promise<void> {
  await persistChain;
}
