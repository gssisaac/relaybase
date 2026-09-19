import { Hono } from "hono";
import { listSubscriberContactsForBroadcast } from "../lib/subscriber-groups/resolver";
import { refreshNewsletterSubscriberLink } from "../lib/newsletters/subscriber-sync";
import { serializeNewsletterSubscriberContact } from "../lib/newsletters/subscriber-api-serialize";
import { findNewsletter } from "../lib/newsletters/serialize";

export const studioNewsletterSubscribers = new Hono();

// GET /studio/newsletters/:newsletterId/subscribers?status=&q=
studioNewsletterSubscribers.get("/", (c) => {
  const newsletterId = c.req.param("newsletterId")!;
  if (!findNewsletter(newsletterId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim();

  const rows = listSubscriberContactsForBroadcast(newsletterId, {
    status: statusFilter,
    q,
  });

  return c.json({ members: rows.map((row) => serializeNewsletterSubscriberContact(newsletterId, row)) });
});

// POST /studio/newsletters/:newsletterId/subscribers/sync — live group; returns current counts
studioNewsletterSubscribers.post("/sync", async (c) => {
  const newsletterId = c.req.param("newsletterId")!;
  const broadcast = findNewsletter(newsletterId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (!broadcast.subscriberGroupId) {
    return c.json({ error: "broadcast has no linked subscriber group" }, 400);
  }

  const result = refreshNewsletterSubscriberLink(newsletterId, broadcast.subscriberGroupId);
  return c.json({
    added: 0,
    updated: 0,
    skipped: 0,
    contactCount: result.contactCount,
    activeCount: result.activeCount,
  });
});
