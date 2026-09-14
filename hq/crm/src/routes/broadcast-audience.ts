import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import { listAudienceContactsForBroadcast } from "../lib/audience-resolver";
import { refreshBroadcastAudienceLink } from "../lib/broadcast-audience-sync";

export const crmBroadcastAudience = new Hono();

function findBroadcast(broadcastId: string) {
  return store
    .read()
    .broadcasts.find((b) => b.id === broadcastId && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function serializeContact(
  broadcastId: string,
  contact: ReturnType<typeof listAudienceContactsForBroadcast>[number],
) {
  return {
    id: contact.id,
    broadcastId,
    audienceMemberId: contact.id,
    email: contact.email,
    name: contact.name,
    status: contact.sendStatus,
    source: contact.source,
    unsubscribedAt: contact.unsubscribedAt,
    bouncedAt: contact.bouncedAt ?? null,
    bounceReason: contact.bounceReason ?? null,
    addedAt: contact.addedAt,
  };
}

export function isSuppressed(email: string): boolean {
  return store.read().accountSuppressions.some((s) => s.email === email);
}

// GET /crm/broadcasts/:broadcastId/audience?status=&q=
crmBroadcastAudience.get("/", (c) => {
  const broadcastId = c.req.param("broadcastId")!;
  if (!findBroadcast(broadcastId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim();

  const rows = listAudienceContactsForBroadcast(broadcastId, {
    status: statusFilter,
    q,
  });

  return c.json({ members: rows.map((row) => serializeContact(broadcastId, row)) });
});

// POST /crm/broadcasts/:broadcastId/audience/sync — live group; returns current counts
crmBroadcastAudience.post("/sync", async (c) => {
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
