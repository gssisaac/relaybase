import { Hono } from "hono";
import type { Env } from "./env";
import { desktopCors } from "./lib/cors";
import { consoleAudienceGroups } from "./routes/console/audience-groups";
import { consoleBroadcasts } from "./routes/console/broadcasts";
import { consoleConnect } from "./routes/console/connect";
import {
  consoleAddresses,
  consoleDomains,
  consoleMailbox,
} from "./routes/console/mailbox";
import { consoleKeys } from "./routes/console/keys";
import { consoleOpsLogs } from "./routes/console/ops-logs";
import { consoleRecoverAdmin } from "./routes/console/recover-admin";
import { consoleRegisterOwner } from "./routes/console/register-owner";
import { consoleStats } from "./routes/console/stats";
import { mailInbox } from "./routes/mail/inbox";
import { mailSend } from "./routes/mail/send";
import { mailSent } from "./routes/mail/sent";
import { mobile } from "./routes/mobile";
import { send } from "./routes/send";
import { v1Inbox } from "./routes/v1-inbox";
import { v1Webhooks } from "./routes/v1-webhooks";

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

// Packaged Tauri webview fetches Worker console/mail routes cross-origin.
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

// End-user management (admin-token auth).
app.route("/console/keys", consoleKeys);
app.route("/console/ops-logs", consoleOpsLogs);
app.route("/console/connect", consoleConnect);
app.route("/console/register-owner", consoleRegisterOwner);
app.route("/console/recover-admin", consoleRecoverAdmin);
app.route("/console/mailbox", consoleMailbox);
app.route("/console/domains", consoleDomains);
app.route("/console/addresses", consoleAddresses);
app.route("/console/audience-groups", consoleAudienceGroups);
app.route("/console/broadcasts", consoleBroadcasts);
app.route("/console/stats", consoleStats);

// End-user mail operations (admin-token auth).
app.route("/mail/inbox", mailInbox);
app.route("/mail/send", mailSend);
app.route("/mail/sent", mailSent);

// Flutter mobile app (mobile-password auth). Peer to /v1/*.
app.route("/mobile", mobile);

app.route("/v1/inbox", v1Inbox);
app.route("/v1/webhooks", v1Webhooks);
app.route("/v1/send", send);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
