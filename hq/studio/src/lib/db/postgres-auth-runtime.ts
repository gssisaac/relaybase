import type { HqAuthStore } from "@db/auth-types";
import { persistAuthStoreToPostgres } from "@lib/orm/postgres-auth-persist";

let cache: HqAuthStore | null = null;
let persistChain: Promise<void> = Promise.resolve();

export function getPostgresAuthCache(): HqAuthStore | null {
  return cache;
}

export function setPostgresAuthCache(next: HqAuthStore): void {
  cache = next;
}

function cloneAuthStore(raw: HqAuthStore): HqAuthStore {
  return structuredClone(raw);
}

export function readPostgresAuthClone(): HqAuthStore {
  if (!cache) {
    throw new Error("PostgreSQL auth cache is not initialized");
  }
  return cloneAuthStore(cache);
}

export function commitPostgresAuthCache(next: HqAuthStore): HqAuthStore {
  cache = next;
  persistChain = persistChain
    .then(() => persistAuthStoreToPostgres(next))
    .catch((err) => {
      console.error("[auth-store] PostgreSQL persist failed:", err);
      throw err;
    });
  return cloneAuthStore(next);
}

export async function flushPostgresAuthPersist(): Promise<void> {
  await persistChain;
}
