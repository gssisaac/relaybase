import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";

const adminConnect = new Hono<{ Bindings: Env }>();

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
adminConnect.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const r2Configured = await checkInboundR2(c.env.INBOUND);
  return c.json({
    ok: true,
    product: "relaybase",
    workerScriptName: c.env.WORKER_SCRIPT_NAME || "relaybase-api",
    inbound: {
      r2Configured,
      bucketName: c.env.INBOUND_BUCKET_NAME || "relaybase-inbound",
    },
  });
});

export { adminConnect };
