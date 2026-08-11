import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";

const consoleRegisterOwner = new Hono<{ Bindings: Env }>();

const OWNER_KV_KEY = "srv:config:owner:email";
const WORKER_URL_KV_KEY = "srv:config:owner:worker_url";

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Records the Relaybase console account that owns this Worker. Called by the
 * desktop app after a successful install (admin-token auth proves the caller
 * controls this Worker). The owner email is later matched during
 * ADMIN_TOKEN recovery so a recovery token can only reset a Worker that
 * belongs to the issuing account.
 *
 * Body: { accountEmail, workerUrl }
 */
consoleRegisterOwner.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { accountEmail?: string; workerUrl?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const email = body.accountEmail?.trim().toLowerCase() ?? "";
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") ?? "";
  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "A valid accountEmail is required" }, 400);
  }
  if (!workerUrl || !/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(workerUrl)) {
    return c.json({ error: "A valid https://*.workers.dev workerUrl is required" }, 400);
  }

  await c.env.RELAYBASE_APP.put(OWNER_KV_KEY, email);
  await c.env.RELAYBASE_APP.put(WORKER_URL_KV_KEY, workerUrl);

  return c.json({ ok: true, ownerEmail: email, workerUrl });
});

/** Returns the owner email (admin auth) — used by the desktop to confirm. */
consoleRegisterOwner.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const email = await c.env.RELAYBASE_APP.get(OWNER_KV_KEY);
  const workerUrl = await c.env.RELAYBASE_APP.get(WORKER_URL_KV_KEY);
  return c.json({ ok: true, ownerEmail: email ?? null, workerUrl: workerUrl ?? null });
});

export { consoleRegisterOwner };
