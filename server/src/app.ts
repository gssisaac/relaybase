import { Hono } from "hono";
import type { Env } from "./env";
import { desktopCors } from "./lib/cors";
import { probeD1Connection } from "./lib/d1-status";
import { consoleAudienceGroups } from "./routes/console/audience-groups";
import { consoleAuthTokens } from "./routes/console/auth-tokens";
import { consoleBroadcasts } from "./routes/console/broadcasts";
import { consoleConnect } from "./routes/console/connect";
import { consoleInitDb } from "./routes/console/init-db";
import {
  consoleAddresses,
  consoleDomains,
  consoleMailbox,
} from "./routes/console/mailbox";
import { consoleBranding } from "./routes/console/branding";
import { consoleKeys } from "./routes/console/keys";
import { consoleOpsLogs } from "./routes/console/ops-logs";
import { consoleRecoverAdmin } from "./routes/console/recover-admin";
import { consoleRegisterOwner } from "./routes/console/register-owner";
import { consoleSendLogs } from "./routes/console/send-logs";
import { consoleStats } from "./routes/console/stats";
import { mailFavicon } from "./routes/mail/favicon";
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
  const [r2Configured, d1] = await Promise.all([
    checkInboundR2(c.env.INBOUND),
    probeD1Connection(
      c.env.RELAYBASE_LOGS,
      c.env.RELAYBASE_INBOX_INDEX,
      c.env.RELAYBASE_DB,
      c.env.CF_ACCOUNT_ID,
      c.env.CF_API_TOKEN,
    ),
  ]);
  return c.json({
    ok: true,
    version: c.env.WORKER_VERSION?.trim() || "unknown",
    inbound: {
      r2Configured,
      bucketName: c.env.INBOUND_BUCKET_NAME,
    },
    d1,
    // Binding present ≠ schema ready. `configured` is table-ready.
    d1Bound: {
      logs: Boolean(c.env.RELAYBASE_LOGS),
      inboxIndex: Boolean(c.env.RELAYBASE_INBOX_INDEX),
      app: Boolean(c.env.RELAYBASE_DB),
    },
  });
});

// End-user management (admin-token auth).
app.route("/console/keys", consoleKeys);
app.route("/console/auth-tokens", consoleAuthTokens);
app.route("/console/ops-logs", consoleOpsLogs);
app.route("/console/send-logs", consoleSendLogs);
app.route("/console/branding", consoleBranding);
app.route("/console/connect", consoleConnect);
app.route("/console/init-db", consoleInitDb);
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
app.route("/mail/favicon", mailFavicon);

// Flutter mobile app (mobile-password auth). Peer to /v1/*.
app.route("/mobile", mobile);

app.route("/v1/inbox", v1Inbox);
app.route("/v1/webhooks", v1Webhooks);
app.route("/v1/send", send);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  const detail = err instanceof Error ? err.message : String(err);
  return c.json({ error: "Internal server error", detail }, 500);
});

export default app;
