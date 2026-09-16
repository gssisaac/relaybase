import { store } from "../../db/store";
import { findAudienceContactByUnsubscribeToken } from "../audience-groups/resolver";
import { setAudienceContactSendStatus } from "../audience-groups/send-status";

function findContactForBroadcast(newsletterId: string, token: string) {
  const data = store.read();
  const broadcast = data.newsletters.find((b) => b.id === newsletterId);
  if (!broadcast?.audienceGroupId) return { broadcast, contact: undefined };
  const contact = findAudienceContactByUnsubscribeToken(broadcast.audienceGroupId, token);
  return { broadcast, contact };
}

function recordUnsubscribeOnRecipients(newsletterId: string, email: string, now: string) {
  store.update((draft) => {
    let newlyMarked = false;
    for (let i = 0; i < draft.recipients.length; i += 1) {
      const r = draft.recipients[i]!;
      if (r.newsletterId !== newsletterId || r.email !== email || r.unsubscribedAt) continue;
      draft.recipients[i] = { ...r, unsubscribedAt: now };
      newlyMarked = true;
    }
    if (!newlyMarked) return;
    const bIdx = draft.newsletters.findIndex((b) => b.id === newsletterId);
    if (bIdx >= 0) {
      const stats = draft.newsletters[bIdx]!.stats;
      draft.newsletters[bIdx] = {
        ...draft.newsletters[bIdx]!,
        stats: { ...stats, unsubscribed: stats.unsubscribed + 1 },
      };
    }
  });
}

export function lookupUnsubscribeContact(newsletterId: string, token: string) {
  return findContactForBroadcast(newsletterId, token);
}

export function performBroadcastUnsubscribe(
  newsletterId: string,
  token: string,
): { ok: true; email: string; listName: string } | { ok: false } {
  const { broadcast, contact } = findContactForBroadcast(newsletterId, token);
  if (!contact || !broadcast) return { ok: false };

  const now = new Date().toISOString();
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "unsubscribed", {
    sourceNewsletterId: newsletterId,
  });
  recordUnsubscribeOnRecipients(newsletterId, contact.email, now);

  return {
    ok: true,
    email: contact.email,
    listName: broadcast.name ?? "this list",
  };
}

export function resubscribeBroadcastContact(newsletterId: string, token: string): boolean {
  const { broadcast, contact } = findContactForBroadcast(newsletterId, token);
  if (!contact || !broadcast) return false;
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "active");
  return true;
}
