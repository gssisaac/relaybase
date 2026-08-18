import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { listStoredSent } from "../../lib/sent-store";

const mailSent = new Hono<{ Bindings: Env }>();

mailSent.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const sent = await listStoredSent(c.env.INBOUND, domain);
  return c.json({ sent });
});

export { mailSent };
