import { initPostgresAuthStore } from "./db/auth-store";
import { initStudioDataSource, isPostgresStoreEnabled } from "./db/orm/data-source";
import { initPostgresStudioStore } from "./db/store";

let postgresReady: Promise<void> | null = null;

/** Idempotent PostgreSQL store + auth initialization (Node server and Worker). */
export function ensurePostgresBootstrap(): Promise<void> {
  if (!isPostgresStoreEnabled()) {
    return Promise.reject(new Error("DATABASE_URL is required for PostgreSQL bootstrap"));
  }
  if (!postgresReady) {
    postgresReady = (async () => {
      await initStudioDataSource();
      await initPostgresStudioStore();
      await initPostgresAuthStore();
    })();
  }
  return postgresReady;
}
