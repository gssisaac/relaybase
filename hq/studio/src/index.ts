import { serve } from "@hono/node-server";
import app from "./app";
import { readEnv } from "./env";
import { startScheduler } from "./scheduler";
import { store } from "./db/store";

const env = readEnv();
const port = Number(env.PORT ?? 32831);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`relaybase-studio listening on http://localhost:${info.port}`);
  console.log(`relaybase-studio JSON store: ${store.dataDir}`);
  startScheduler();
});
