import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { listStoredSentPage } from "../../lib/sent-store";

const mailSent = new Hono<{ Bindings: Env }>();

// Cursor-paginated (newest first). Without `limit` the full index is
// returned in one page, which keeps older clients working.
mailSent.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const rawLimit = c.req.query("limit");
  const limit = rawLimit ? Number(rawLimit) : undefined;
  const before = c.req.query("before")?.trim() || undefined;
  const page = await listStoredSentPage(c.env.INBOUND, domain, {
    // No limit param → legacy full-index response.
    limit: rawLimit && Number.isFinite(limit) ? limit : 5000,
    before,
  });

  return c.json({
    sent: page.sent,
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    total: page.total,
  });
});

export { mailSent };
