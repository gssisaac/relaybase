import { initPostgresAuthStore } from "./db/auth-store";
import { assertPostgresStoreConfigured, initStudioDataSource } from "./db/orm/data-source";
import { initPostgresStudioStore } from "./db/store";

let postgresReady: Promise<void> | null = null;

/** Idempotent PostgreSQL store + auth initialization (Node server and Worker). */
export function ensurePostgresBootstrap(): Promise<void> {
  assertPostgresStoreConfigured();
  if (!postgresReady) {
    postgresReady = (async () => {
      await initStudioDataSource();
      await initPostgresStudioStore();
      await initPostgresAuthStore();
    })();
  }
  return postgresReady;
}
