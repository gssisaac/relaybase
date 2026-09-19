import { studioService } from "@services/studio-service";
import { requireMessage } from "@lib/messages/resolve";
import { findSubscriberContactByUnsubscribeToken } from "@lib/subscriber-groups/resolver";
import { setSubscriberContactSendStatus } from "@lib/subscriber-groups/send-status";

function findContactForBroadcast(newsletterId: string, token: string) {
  const data = studioService.read();
  const broadcast = data.newsletters.find((b) => b.id === newsletterId);
  if (!broadcast?.subscriberGroupId) return { broadcast, contact: undefined };
  const contact = findSubscriberContactByUnsubscribeToken(broadcast.subscriberGroupId, token);
  return { broadcast, contact };
}

function recordUnsubscribeOnRecipients(newsletterId: string, email: string, now: string) {
  studioService.update((draft) => {
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
  setSubscriberContactSendStatus(broadcast.subscriberGroupId, contact.id, "unsubscribed", {
    sourceNewsletterId: newsletterId,
  });
  recordUnsubscribeOnRecipients(newsletterId, contact.email, now);

  return {
    ok: true,
    email: contact.email,
    listName: requireMessage(studioService.read(), broadcast.messageId).subject.trim() || "this list",
  };
}

export function resubscribeBroadcastContact(newsletterId: string, token: string): boolean {
  const { broadcast, contact } = findContactForBroadcast(newsletterId, token);
  if (!contact || !broadcast) return false;
  setSubscriberContactSendStatus(broadcast.subscriberGroupId, contact.id, "active");
  return true;
}
