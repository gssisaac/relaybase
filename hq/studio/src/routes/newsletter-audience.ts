import { Hono } from "hono";
import { listAudienceContactsForBroadcast } from "../lib/audience-groups/resolver";
import { refreshNewsletterAudienceLink } from "../lib/newsletters/audience-sync";
import { serializeNewsletterAudienceContact } from "../lib/newsletters/audience-api-serialize";
import { findNewsletter } from "../lib/newsletters/serialize";

export const studioNewsletterAudience = new Hono();

// GET /studio/newsletters/:newsletterId/audience?status=&q=
studioNewsletterAudience.get("/", (c) => {
  const newsletterId = c.req.param("newsletterId")!;
  if (!findNewsletter(newsletterId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim();

  const rows = listAudienceContactsForBroadcast(newsletterId, {
    status: statusFilter,
    q,
  });

  return c.json({ members: rows.map((row) => serializeNewsletterAudienceContact(newsletterId, row)) });
});

// POST /studio/newsletters/:newsletterId/audience/sync — live group; returns current counts
studioNewsletterAudience.post("/sync", async (c) => {
  const newsletterId = c.req.param("newsletterId")!;
  const broadcast = findNewsletter(newsletterId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (!broadcast.audienceGroupId) {
    return c.json({ error: "broadcast has no linked audience group" }, 400);
  }

  const result = refreshNewsletterAudienceLink(newsletterId, broadcast.audienceGroupId);
  return c.json({
    added: 0,
    updated: 0,
    skipped: 0,
    contactCount: result.contactCount,
    activeCount: result.activeCount,
  });
});
