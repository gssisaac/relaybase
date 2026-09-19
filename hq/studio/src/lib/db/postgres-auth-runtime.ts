import type { HqAuthStore } from "@db/auth-types";

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

/** Update in-memory auth cache only (after a targeted TypeORM write). */
export function patchPostgresAuthCache(mutator: (draft: HqAuthStore) => void): HqAuthStore {
  const draft = readPostgresAuthClone();
  mutator(draft);
  cache = draft;
  return cloneAuthStore(draft);
}

export function enqueueAuthPersist(task: () => Promise<void>): void {
  persistChain = persistChain
    .then(task)
    .catch((err) => {
      console.error("[auth-store] PostgreSQL persist failed:", err);
      throw err;
    });
}

export async function flushPostgresAuthPersist(): Promise<void> {
  await persistChain;
}
