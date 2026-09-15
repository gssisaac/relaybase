import { Hono } from "hono";
import { listAudienceContactsForBroadcast } from "../lib/audience-groups/resolver";
import { refreshCampaignAudienceLink } from "../lib/campaigns/audience-sync";
import { serializeCampaignAudienceContact } from "../lib/campaigns/audience-api-serialize";
import { findCampaign } from "../lib/campaigns/serialize";

export const scaleCampaignAudience = new Hono();

// GET /scale/campaigns/:campaignId/audience?status=&q=
scaleCampaignAudience.get("/", (c) => {
  const campaignId = c.req.param("campaignId")!;
  if (!findCampaign(campaignId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim();

  const rows = listAudienceContactsForBroadcast(campaignId, {
    status: statusFilter,
    q,
  });

  return c.json({ members: rows.map((row) => serializeCampaignAudienceContact(campaignId, row)) });
});

// POST /scale/campaigns/:campaignId/audience/sync — live group; returns current counts
scaleCampaignAudience.post("/sync", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcast = findCampaign(campaignId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (!broadcast.audienceGroupId) {
    return c.json({ error: "broadcast has no linked audience group" }, 400);
  }

  const result = refreshCampaignAudienceLink(campaignId, broadcast.audienceGroupId);
  return c.json({
    added: 0,
    updated: 0,
    skipped: 0,
    contactCount: result.contactCount,
    activeCount: result.activeCount,
  });
});
