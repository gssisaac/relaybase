import { Hono } from "hono";
import type { Env } from "./env";
import { adminBootstrap } from "./routes/admin-bootstrap";
import { adminCloudflare } from "./routes/admin-cloudflare";
import { adminKeys } from "./routes/admin-keys";
import { adminLogs } from "./routes/admin-logs";
import { send } from "./routes/send";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.route("/admin/keys", adminKeys);
app.route("/admin/logs", adminLogs);
app.route("/admin/cloudflare", adminCloudflare);
app.route("/admin/bootstrap", adminBootstrap);
app.route("/v1/send", send);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
