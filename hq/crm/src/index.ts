import { serve } from "@hono/node-server";
import app from "./app";
import { readEnv } from "./env";
import { startScheduler } from "./scheduler";
import "./db/client";

const env = readEnv();
const port = Number(env.PORT ?? 32831);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`relaybase-crm listening on http://localhost:${info.port}`);
  startScheduler();
});
