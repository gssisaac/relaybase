import { Hono } from "hono";
import type { Env } from "./env";
import { desktopCors } from "./lib/cors";
import { adminAudienceGroups } from "./routes/admin-audience-groups";
import { adminBootstrap } from "./routes/admin-bootstrap";
import { adminBroadcasts } from "./routes/admin-broadcasts";
import { adminCloudflare } from "./routes/admin-cloudflare";
import { adminConnect } from "./routes/admin-connect";
import { adminInbox } from "./routes/admin-inbox";
import { adminKeys } from "./routes/admin-keys";
import { adminLogs } from "./routes/admin-logs";
import {
  adminAddresses,
  adminDomains,
  adminMailbox,
} from "./routes/admin-mailbox";
import { adminOpsLogs } from "./routes/admin-ops-logs";
import { adminSend } from "./routes/admin-send";
import { adminStats } from "./routes/admin-stats";
import { adminVersion } from "./routes/admin-version";
import { send } from "./routes/send";
import { v1Inbox } from "./routes/v1-inbox";
import { v1Webhooks } from "./routes/v1-webhooks";
import { license } from "./routes/license";
import { waitlistOptions, waitlistPost } from "./routes/waitlist";

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

// Packaged Tauri webview fetches Worker admin routes cross-origin.
app.use("*", desktopCors);

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
app.route("/admin/ops-logs", adminOpsLogs);
app.route("/admin/cloudflare", adminCloudflare);
app.route("/admin/connect", adminConnect);
app.route("/admin/version", adminVersion);
app.route("/admin/bootstrap", adminBootstrap);
app.route("/admin/inbox", adminInbox);
app.route("/admin/mailbox", adminMailbox);
app.route("/admin/domains", adminDomains);
app.route("/admin/addresses", adminAddresses);
app.route("/admin/send", adminSend);
app.route("/admin/audience-groups", adminAudienceGroups);
app.route("/admin/broadcasts", adminBroadcasts);
app.route("/admin/stats", adminStats);
app.route("/v1/inbox", v1Inbox);
app.route("/v1/webhooks", v1Webhooks);
app.route("/v1/send", send);
app.route("/v1/license", license);
app.options("/v1/waitlist", waitlistOptions);
app.post("/v1/waitlist", waitlistPost);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
