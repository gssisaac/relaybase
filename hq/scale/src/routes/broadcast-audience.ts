import { Hono } from "hono";
import { listAudienceContactsForBroadcast } from "../lib/audience-groups/resolver";
import { refreshBroadcastAudienceLink } from "../lib/broadcasts/audience-sync";
import { serializeBroadcastAudienceContact } from "../lib/broadcasts/audience-api-serialize";
import { findBroadcast } from "../lib/broadcasts/serialize";

export const scaleBroadcastAudience = new Hono();

// GET /scale/broadcasts/:broadcastId/audience?status=&q=
scaleBroadcastAudience.get("/", (c) => {
  const broadcastId = c.req.param("broadcastId")!;
  if (!findBroadcast(broadcastId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim();

  const rows = listAudienceContactsForBroadcast(broadcastId, {
    status: statusFilter,
    q,
  });

  return c.json({ members: rows.map((row) => serializeBroadcastAudienceContact(broadcastId, row)) });
});

// POST /scale/broadcasts/:broadcastId/audience/sync — live group; returns current counts
scaleBroadcastAudience.post("/sync", async (c) => {
  const broadcastId = c.req.param("broadcastId")!;
  const broadcast = findBroadcast(broadcastId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (!broadcast.audienceGroupId) {
    return c.json({ error: "broadcast has no linked audience group" }, 400);
  }

  const result = refreshBroadcastAudienceLink(broadcastId, broadcast.audienceGroupId);
  return c.json({
    added: 0,
    updated: 0,
    skipped: 0,
    contactCount: result.contactCount,
    activeCount: result.activeCount,
  });
});
