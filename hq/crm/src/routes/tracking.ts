import { Hono } from "hono";
import { store } from "../db/store";
import { newId } from "../lib/ids";
import { resolveSafeRedirectTarget } from "../lib/tracking-redirect";

export const crmTracking = new Hono();

/** 1x1 transparent GIF (P0-2). */
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);

function recordOpen(broadcastId: string, recipientId: string) {
  try {
    const recipient = store.read().recipients.find((r) => r.id === recipientId && r.broadcastId === broadcastId);
    if (!recipient) return;
    const now = new Date().toISOString();
    const firstOpen = !recipient.openedAt;
    store.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipientId);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        openedAt: draft.recipients[idx]!.openedAt ?? now,
        openCount: draft.recipients[idx]!.openCount + 1,
      };
      draft.trackingEvents.push({
        id: newId("track"),
        broadcastId,
        recipientId,
        memberEmail: recipient.email,
        type: "open",
        url: null,
        reason: null,
        occurredAt: now,
      });
      const bIdx = draft.broadcasts.findIndex((b) => b.id === broadcastId);
      if (bIdx >= 0) {
        const stats = draft.broadcasts[bIdx]!.stats;
        draft.broadcasts[bIdx] = {
          ...draft.broadcasts[bIdx]!,
          stats: {
            ...stats,
            opened: firstOpen ? stats.opened + 1 : stats.opened,
            totalOpens: stats.totalOpens + 1,
          },
        };
      }
    });
  } catch (err) {
    console.error("[crm-tracking] failed to record open", err);
  }
}

function recordClick(broadcastId: string, recipientId: string, url: string) {
  try {
    const recipient = store.read().recipients.find((r) => r.id === recipientId && r.broadcastId === broadcastId);
    if (!recipient) return;
    const now = new Date().toISOString();
    const firstClick = !recipient.clickedAt;
    store.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipientId);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        clickedAt: draft.recipients[idx]!.clickedAt ?? now,
        clickCount: draft.recipients[idx]!.clickCount + 1,
      };
      draft.trackingEvents.push({
        id: newId("track"),
        broadcastId,
        recipientId,
        memberEmail: recipient.email,
        type: "click",
        url,
        reason: null,
        occurredAt: now,
      });
      const bIdx = draft.broadcasts.findIndex((b) => b.id === broadcastId);
      if (bIdx >= 0) {
        const stats = draft.broadcasts[bIdx]!.stats;
        draft.broadcasts[bIdx] = {
          ...draft.broadcasts[bIdx]!,
          stats: {
            ...stats,
            clicked: firstClick ? stats.clicked + 1 : stats.clicked,
            totalClicks: stats.totalClicks + 1,
          },
        };
      }
    });
  } catch (err) {
    console.error("[crm-tracking] failed to record click", err);
  }
}

// GET /crm/t/o/:broadcastId/:recipientId — open pixel
crmTracking.get("/o/:broadcastId/:recipientId", async (c) => {
  const { broadcastId, recipientId } = c.req.param();
  recordOpen(broadcastId, recipientId);

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(PIXEL_GIF);
});

// GET /crm/t/c/:broadcastId/:recipientId?u=<original> — click redirect
crmTracking.get("/c/:broadcastId/:recipientId", async (c) => {
  const { broadcastId, recipientId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  const safe = resolveSafeRedirectTarget(target);
  if (!safe) return c.json({ error: "invalid redirect target" }, 400);

  recordClick(broadcastId, recipientId, safe);

  return c.redirect(safe, 302);
});
