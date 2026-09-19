import "reflect-metadata";
import { serve } from "@hono/node-server";
import app from "@/app";
import { ensurePostgresBootstrap } from "@/bootstrap-postgres";
import { assertPostgresStoreConfigured } from "@lib/orm/data-source";
import { flushPostgresAuthPersist } from "@lib/db/postgres-auth-runtime";
import { flushStudioDocumentPersist } from "@services/studio/studio-document.service";
import { readEnv } from "@/env";
import { startScheduler } from "@/scheduler";

const env = readEnv();
/** Default 32832 — 32831 is reserved for desktop CF OAuth loopback (Tauri). */
const port = Number(env.PORT ?? 32832);

async function main() {
  assertPostgresStoreConfigured();
  await ensurePostgresBootstrap();
  console.log("relaybase-studio PostgreSQL: connected (store + auth)");

  const shutdown = async (signal: string) => {
    console.log(`[studio] ${signal} — flushing PostgreSQL writes…`);
    try {
      await flushStudioDocumentPersist();
      await flushPostgresAuthPersist();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`relaybase-studio listening on http://localhost:${info.port}`);
    console.log("relaybase-studio persistence: PostgreSQL");
    startScheduler();
  });
}

main().catch((err) => {
  console.error("[studio] Failed to start:", err);
  process.exit(1);
});
