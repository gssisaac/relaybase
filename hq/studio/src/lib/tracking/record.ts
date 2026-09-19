import { studioService } from "@services/studio-service";
import { newId } from "@lib/shared/ids";

export function recordTrackingOpen(newsletterId: string, recipientId: string) {
  try {
    const recipient = studioService.read().recipients.find((r) => r.id === recipientId && r.newsletterId === newsletterId);
    if (!recipient) return;
    const now = new Date().toISOString();
    const firstOpen = !recipient.openedAt;
    studioService.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipientId);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        openedAt: draft.recipients[idx]!.openedAt ?? now,
        openCount: draft.recipients[idx]!.openCount + 1,
      };
      draft.trackingEvents.push({
        id: newId("track"),
        newsletterId,
        recipientId,
        memberEmail: recipient.email,
        type: "open",
        url: null,
        reason: null,
        occurredAt: now,
      });
      const bIdx = draft.newsletters.findIndex((b) => b.id === newsletterId);
      if (bIdx >= 0) {
        const stats = draft.newsletters[bIdx]!.stats;
        draft.newsletters[bIdx] = {
          ...draft.newsletters[bIdx]!,
          stats: {
            ...stats,
            opened: firstOpen ? stats.opened + 1 : stats.opened,
            totalOpens: stats.totalOpens + 1,
          },
        };
      }
    });
  } catch (err) {
    console.error("[studio-tracking] failed to record open", err);
  }
}

export function recordTrackingClick(newsletterId: string, recipientId: string, url: string) {
  try {
    const recipient = studioService.read().recipients.find((r) => r.id === recipientId && r.newsletterId === newsletterId);
    if (!recipient) return;
    const now = new Date().toISOString();
    const firstClick = !recipient.clickedAt;
    studioService.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipientId);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        clickedAt: draft.recipients[idx]!.clickedAt ?? now,
        clickCount: draft.recipients[idx]!.clickCount + 1,
      };
      draft.trackingEvents.push({
        id: newId("track"),
        newsletterId,
        recipientId,
        memberEmail: recipient.email,
        type: "click",
        url,
        reason: null,
        occurredAt: now,
      });
      const bIdx = draft.newsletters.findIndex((b) => b.id === newsletterId);
      if (bIdx >= 0) {
        const stats = draft.newsletters[bIdx]!.stats;
        draft.newsletters[bIdx] = {
          ...draft.newsletters[bIdx]!,
          stats: {
            ...stats,
            clicked: firstClick ? stats.clicked + 1 : stats.clicked,
            totalClicks: stats.totalClicks + 1,
          },
        };
      }
    });
  } catch (err) {
    console.error("[studio-tracking] failed to record click", err);
  }
}

/** 1x1 transparent GIF (P0-2). */
export const TRACKING_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);
