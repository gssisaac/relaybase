import { store } from "../../db/store";
import { newId } from "../shared/ids";

export function recordTrackingOpen(campaignId: string, recipientId: string) {
  try {
    const recipient = store.read().recipients.find((r) => r.id === recipientId && r.campaignId === campaignId);
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
        campaignId,
        recipientId,
        memberEmail: recipient.email,
        type: "open",
        url: null,
        reason: null,
        occurredAt: now,
      });
      const bIdx = draft.campaigns.findIndex((b) => b.id === campaignId);
      if (bIdx >= 0) {
        const stats = draft.campaigns[bIdx]!.stats;
        draft.campaigns[bIdx] = {
          ...draft.campaigns[bIdx]!,
          stats: {
            ...stats,
            opened: firstOpen ? stats.opened + 1 : stats.opened,
            totalOpens: stats.totalOpens + 1,
          },
        };
      }
    });
  } catch (err) {
    console.error("[scale-tracking] failed to record open", err);
  }
}

export function recordTrackingClick(campaignId: string, recipientId: string, url: string) {
  try {
    const recipient = store.read().recipients.find((r) => r.id === recipientId && r.campaignId === campaignId);
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
        campaignId,
        recipientId,
        memberEmail: recipient.email,
        type: "click",
        url,
        reason: null,
        occurredAt: now,
      });
      const bIdx = draft.campaigns.findIndex((b) => b.id === campaignId);
      if (bIdx >= 0) {
        const stats = draft.campaigns[bIdx]!.stats;
        draft.campaigns[bIdx] = {
          ...draft.campaigns[bIdx]!,
          stats: {
            ...stats,
            clicked: firstClick ? stats.clicked + 1 : stats.clicked,
            totalClicks: stats.totalClicks + 1,
          },
        };
      }
    });
  } catch (err) {
    console.error("[scale-tracking] failed to record click", err);
  }
}

/** 1x1 transparent GIF (P0-2). */
export const TRACKING_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);
