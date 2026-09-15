import { store } from "../../db/store";
import { findAudienceContactByUnsubscribeToken } from "../audience-groups/resolver";
import { setAudienceContactSendStatus } from "../audience-groups/send-status";

function findContactForBroadcast(broadcastId: string, token: string) {
  const data = store.read();
  const broadcast = data.broadcasts.find((b) => b.id === broadcastId);
  if (!broadcast?.audienceGroupId) return { broadcast, contact: undefined };
  const contact = findAudienceContactByUnsubscribeToken(broadcast.audienceGroupId, token);
  return { broadcast, contact };
}

function recordUnsubscribeOnRecipients(broadcastId: string, email: string, now: string) {
  store.update((draft) => {
    let newlyMarked = false;
    for (let i = 0; i < draft.recipients.length; i += 1) {
      const r = draft.recipients[i]!;
      if (r.broadcastId !== broadcastId || r.email !== email || r.unsubscribedAt) continue;
      draft.recipients[i] = { ...r, unsubscribedAt: now };
      newlyMarked = true;
    }
    if (!newlyMarked) return;
    const bIdx = draft.broadcasts.findIndex((b) => b.id === broadcastId);
    if (bIdx >= 0) {
      const stats = draft.broadcasts[bIdx]!.stats;
      draft.broadcasts[bIdx] = {
        ...draft.broadcasts[bIdx]!,
        stats: { ...stats, unsubscribed: stats.unsubscribed + 1 },
      };
    }
  });
}

export function lookupUnsubscribeContact(broadcastId: string, token: string) {
  return findContactForBroadcast(broadcastId, token);
}

export function performBroadcastUnsubscribe(
  broadcastId: string,
  token: string,
): { ok: true; email: string; listName: string } | { ok: false } {
  const { broadcast, contact } = findContactForBroadcast(broadcastId, token);
  if (!contact || !broadcast) return { ok: false };

  const now = new Date().toISOString();
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "unsubscribed", {
    sourceBroadcastId: broadcastId,
  });
  recordUnsubscribeOnRecipients(broadcastId, contact.email, now);

  return {
    ok: true,
    email: contact.email,
    listName: broadcast.name ?? "this list",
  };
}

export function resubscribeBroadcastContact(broadcastId: string, token: string): boolean {
  const { broadcast, contact } = findContactForBroadcast(broadcastId, token);
  if (!contact || !broadcast) return false;
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "active");
  return true;
}
