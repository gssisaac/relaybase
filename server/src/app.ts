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
import { consoleStats } from "./routes/console/stats";
import { mailInbox } from "./routes/mail/inbox";
import { mailSend } from "./routes/mail/send";
import { mobile } from "./routes/mobile";
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
app.route("/console/mailbox", consoleMailbox);
app.route("/console/domains", consoleDomains);
app.route("/console/addresses", consoleAddresses);
app.route("/console/audience-groups", consoleAudienceGroups);
app.route("/console/broadcasts", consoleBroadcasts);
app.route("/console/stats", consoleStats);

// End-user mail operations (admin-token auth).
app.route("/mail/inbox", mailInbox);
app.route("/mail/send", mailSend);

// Flutter mobile app (mobile-password auth). Peer to /v1/*.
app.route("/mobile", mobile);

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
