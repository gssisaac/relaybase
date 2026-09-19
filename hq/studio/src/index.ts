import "reflect-metadata";
import { serve } from "@hono/node-server";
import app from "./app";
import { initStudioDataSource, isPostgresStoreEnabled } from "./db/orm/data-source";
import { store } from "./db/store";
import { readEnv } from "./env";
import { startScheduler } from "./scheduler";

const env = readEnv();
/** Default 32832 — 32831 is reserved for desktop CF OAuth loopback (Tauri). */
const port = Number(env.PORT ?? 32832);

async function main() {
  if (isPostgresStoreEnabled()) {
    await initStudioDataSource();
    console.log("relaybase-studio PostgreSQL: connected (JSON store still active until repository layer lands)");
  }

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`relaybase-studio listening on http://localhost:${info.port}`);
    console.log(`relaybase-studio JSON store: ${store.dataDir}`);
    startScheduler();
  });
}

main().catch((err) => {
  console.error("[studio] Failed to start:", err);
  process.exit(1);
});
