import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { BroadcastMember } from "../db/types";
import {
  findAudienceGroup,
  syncBroadcastAudienceFromGroup,
} from "../lib/broadcast-audience-sync";
import { syncAudienceSendStatusFromBroadcastMember } from "../lib/audience-send-status";

export const crmBroadcastAudience = new Hono();

function findBroadcast(broadcastId: string) {
  return store
    .read()
    .broadcasts.find((b) => b.id === broadcastId && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function resolveContact(broadcastId: string, row: BroadcastMember) {
  const broadcast = findBroadcast(broadcastId);
  if (!broadcast?.audienceGroupId) return { email: row.email, name: row.name ?? null };
  const group = findAudienceGroup(broadcast.audienceGroupId);
  if (!row.audienceMemberId || !group) return { email: row.email, name: row.name ?? null };
  const member = group.contacts.find((c) => c.id === row.audienceMemberId);
  if (!member) return { email: row.email, name: row.name ?? null };
  return { email: member.email, name: member.name ?? null };
}

function serialize(row: BroadcastMember, broadcastId: string) {
  const contact = resolveContact(broadcastId, row);
  return {
    id: row.id,
    broadcastId: row.broadcastId,
    audienceMemberId: row.audienceMemberId,
    email: contact.email,
    name: contact.name,
    status: row.status,
    source: row.source,
    unsubscribedAt: row.unsubscribedAt ?? null,
    bouncedAt: row.bouncedAt ?? null,
    bounceReason: row.bounceReason ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
  const q = c.req.query("q")?.trim().toLowerCase();

  let rows = store.read().broadcastMembers.filter((m) => m.broadcastId === broadcastId);
  if (statusFilter) rows = rows.filter((m) => m.status === statusFilter);
  if (q) {
    rows = rows.filter((m) => {
      const contact = resolveContact(broadcastId, m);
      return contact.email.includes(q) || (contact.name ?? "").toLowerCase().includes(q);
    });
  }
  rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({ members: rows.map((row) => serialize(row, broadcastId)) });
});

// POST /crm/broadcasts/:broadcastId/audience/sync
crmBroadcastAudience.post("/sync", async (c) => {
  const broadcastId = c.req.param("broadcastId")!;
  const broadcast = findBroadcast(broadcastId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (!broadcast.audienceGroupId) {
    return c.json({ error: "broadcast has no linked audience group" }, 400);
  }
  const group = findAudienceGroup(broadcast.audienceGroupId);
  if (!group) return c.json({ error: "linked audience group not found" }, 404);

  const result = syncBroadcastAudienceFromGroup(broadcastId, broadcast.audienceGroupId);
  return c.json(result);
});

// DELETE /crm/broadcasts/:broadcastId/audience/:memberId — admin remove from broadcast audience
crmBroadcastAudience.delete("/:memberId", (c) => {
  const broadcastId = c.req.param("broadcastId")!;
  const memberId = c.req.param("memberId")!;
  const existed = store
    .read()
    .broadcastMembers.some((m) => m.id === memberId && m.broadcastId === broadcastId);
  if (!existed) return c.json({ error: "not found" }, 404);

  store.update((draft) => {
    draft.broadcastMembers = draft.broadcastMembers.filter((m) => m.id !== memberId);
  });
  return c.json({ ok: true });
});

// PATCH /crm/broadcasts/:broadcastId/audience/:memberId { status: "active" | "unsubscribed" }
crmBroadcastAudience.patch("/:memberId", async (c) => {
  const broadcastId = c.req.param("broadcastId")!;
  const memberId = c.req.param("memberId")!;
  const existing = store
    .read()
    .broadcastMembers.find((m) => m.id === memberId && m.broadcastId === broadcastId);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: { status?: "active" | "unsubscribed" };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (body.status !== "active" && body.status !== "unsubscribed") {
    return c.json({ error: "status must be 'active' or 'unsubscribed'" }, 400);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.broadcastMembers.findIndex((m) => m.id === memberId);
    if (idx < 0) return;
    draft.broadcastMembers[idx] = {
      ...draft.broadcastMembers[idx]!,
      status: body.status!,
      unsubscribedAt: body.status === "unsubscribed" ? now : null,
      updatedAt: now,
    };
  });

  const updated = store
    .read()
    .broadcastMembers.find((m) => m.id === memberId && m.broadcastId === broadcastId)!;
  if (updated.audienceMemberId) {
    syncAudienceSendStatusFromBroadcastMember(updated);
  }

  return c.json(serialize(updated, broadcastId));
});
