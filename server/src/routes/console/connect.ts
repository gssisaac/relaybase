import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { probeD1Connection } from "../../lib/d1-status";
import { measureInboundR2Usage } from "../../lib/r2-usage";

const consoleConnect = new Hono<{ Bindings: Env }>();

async function checkInboundR2(bucket: R2Bucket): Promise<boolean> {
  try {
    await bucket.list({ limit: 1 });
    return true;
  } catch (error) {
    console.error("Inbound R2 check failed", error);
    return false;
  }
}

/**
 * Desktop self-install probe: proves the user controls this Worker via ADMIN_TOKEN.
 * Public GET /health is not sufficient (no admin proof).
 */
consoleConnect.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const r2Configured = await checkInboundR2(c.env.INBOUND);
  const [usage, d1] = await Promise.all([
    r2Configured ? measureInboundR2Usage(c.env.INBOUND) : Promise.resolve(null),
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
    product: "relaybase",
    workerScriptName: c.env.WORKER_SCRIPT_NAME || "relaybase-api",
    inbound: {
      r2Configured,
      bucketName: c.env.INBOUND_BUCKET_NAME || "relaybase-mailbox",
      usage,
    },
    d1,
    // Whether the Worker has a CF_API_TOKEN wrangler secret set (i.e. the
    // server token has been pushed). The dashboard uses this — together with
    // the local serverToken + pushedAt — to show "Server token configured".
    cfApiTokenSet: Boolean(c.env.CF_API_TOKEN?.trim()),
  });
});

export { consoleConnect };
