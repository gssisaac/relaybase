import { initPostgresAuthService } from "@services/auth-service";
import { assertPostgresStoreConfigured, initStudioDataSource } from "@lib/orm/data-source";
import { initStudioDocument } from "@services/studio/studio-document.service";

let postgresReady: Promise<void> | null = null;

/** Idempotent PostgreSQL store + auth initialization (Node server and Worker). */
export function ensurePostgresBootstrap(): Promise<void> {
  assertPostgresStoreConfigured();
  if (!postgresReady) {
    postgresReady = (async () => {
      await initStudioDataSource();
      await initPostgresAuthService();
      await initStudioDocument();
    })();
  }
  return postgresReady;
}
