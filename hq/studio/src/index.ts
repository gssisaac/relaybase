import { serve } from "@hono/node-server";
import app from "./app";
import { useNodeFilesystem } from "./cf/storage-fs";
import { readEnv } from "./env";
import { startScheduler } from "./scheduler";
import { store } from "./db/store";

const env = readEnv();
useNodeFilesystem(process.env.STUDIO_DATA_DIR ?? `${process.cwd()}/data`);
/** Default 32832 — 32831 is reserved for desktop CF OAuth loopback (Tauri). */
const port = Number(env.PORT ?? 32832);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`relaybase-studio listening on http://localhost:${info.port}`);
  console.log(`relaybase-studio JSON store: ${store.dataDir}`);
  startScheduler();
});
