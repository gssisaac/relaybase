import { Hono } from "hono";
import type { Env } from "./env";
import { adminBootstrap } from "./routes/admin-bootstrap";
import { adminCloudflare } from "./routes/admin-cloudflare";
import { adminInbox } from "./routes/admin-inbox";
import { adminKeys } from "./routes/admin-keys";
import { adminLogs } from "./routes/admin-logs";
import { send } from "./routes/send";

const app = new Hono<{ Bindings: Env }>();

async function checkInboundR2(bucket: R2Bucket): Promise<boolean> {
  try {
    await bucket.list({ limit: 1 });
    return true;
  } catch (error) {
    console.error("Inbound R2 check failed", error);
    return false;
  }
}

app.get("/health", async (c) => {
  const r2Configured = await checkInboundR2(c.env.INBOUND);
  return c.json({
    ok: true,
    inbound: {
      r2Configured,
      bucketName: c.env.INBOUND_BUCKET_NAME,
    },
  });
});

app.route("/admin/keys", adminKeys);
app.route("/admin/logs", adminLogs);
app.route("/admin/cloudflare", adminCloudflare);
app.route("/admin/bootstrap", adminBootstrap);
app.route("/admin/inbox", adminInbox);
app.route("/v1/send", send);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
