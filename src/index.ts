import { Hono } from "hono";
import type { Env } from "./env";
import { adminKeys } from "./routes/admin-keys";
import { send } from "./routes/send";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.route("/admin/keys", adminKeys);
app.route("/v1/send", send);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
