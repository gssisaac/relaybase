import { Hono } from "hono";
import type { Env } from "../../env";
import { createAppDb } from "../../../db/app";
import { setOwnerAdminToken } from "../../../db/app/owner";

const consoleRecoverAdmin = new Hono<{ Bindings: Env }>();

const CONSOLE_RECOVERY_VERIFY_URL =
  "https://console.relaybase.xyz/v1/recovery/verify-admin-token";

/**
 * Resets the Worker's ADMIN_TOKEN without wrangler, using a one-time recovery
 * token issued by the Relaybase console (console.relaybase.xyz) to the
 * account owner.
 *
 * Flow:
 *   1. Owner loses ADMIN_TOKEN but still controls their Relaybase account
 *      (password recoverable via console.relaybase.xyz/recover).
 *   2. Owner requests an admin-token recovery from the console; a one-time
 *      token is emailed to them.
 *   3. Desktop (or owner) POSTs here with { recoveryToken, newAdminToken,
 *      accountEmail, workerUrl }.
 *   4. This Worker verifies the token with the console, which checks the
 *      token is valid, belongs to accountEmail, and that workerUrl is
 *      registered to that account.
 *   5. On success, this Worker writes newAdminToken to D1 owner_config.
 *      auth.ts accepts the wrangler secret or the D1 override.
 *
 * This endpoint is intentionally UNAUTHENTICATED (the whole point is the
 * admin token is lost). Security comes from the single-use recovery token +
 * account/worker binding verified by the console.
 */
consoleRecoverAdmin.post("/", async (c) => {
  let body: {
    recoveryToken?: string;
    newAdminToken?: string;
    accountEmail?: string;
    workerUrl?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const recoveryToken = body.recoveryToken?.trim() ?? "";
  const newAdminToken = body.newAdminToken?.trim() ?? "";
  const accountEmail = body.accountEmail?.trim().toLowerCase() ?? "";
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") ?? "";

  if (!recoveryToken || !newAdminToken || !accountEmail || !workerUrl) {
    return c.json(
      { error: "recoveryToken, newAdminToken, accountEmail, workerUrl required" },
      400,
    );
  }
  if (newAdminToken.length < 16) {
    return c.json({ error: "newAdminToken must be at least 16 characters" }, 400);
  }

  let verifyOk = false;
  try {
    const res = await fetch(CONSOLE_RECOVERY_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryToken, accountEmail, workerUrl }),
    });
    const data = (await res.json()) as { ok?: boolean };
    verifyOk = res.ok && Boolean(data.ok);
  } catch (err) {
    console.error("Recovery verify failed", err);
    return c.json({ error: "Could not reach recovery service" }, 502);
  }
  if (!verifyOk) {
    return c.json({ error: "Invalid or expired recovery token" }, 403);
  }

  const db = createAppDb(c.env.RELAYBASE_DB);
  if (!db) {
    return c.json(
      { error: "Cannot store recovered token — D1 RELAYBASE_DB is not bound" },
      500,
    );
  }
  await setOwnerAdminToken(db, newAdminToken);

  return c.json({ ok: true });
});

export { consoleRecoverAdmin };
