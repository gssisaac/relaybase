import { store } from "../../db/store";
import { findAudienceContactByUnsubscribeToken } from "../audience-groups/resolver";
import { setAudienceContactSendStatus } from "../audience-groups/send-status";

function findContactForBroadcast(campaignId: string, token: string) {
  const data = store.read();
  const broadcast = data.campaigns.find((b) => b.id === campaignId);
  if (!broadcast?.audienceGroupId) return { broadcast, contact: undefined };
  const contact = findAudienceContactByUnsubscribeToken(broadcast.audienceGroupId, token);
  return { broadcast, contact };
}

function recordUnsubscribeOnRecipients(campaignId: string, email: string, now: string) {
  store.update((draft) => {
    let newlyMarked = false;
    for (let i = 0; i < draft.recipients.length; i += 1) {
      const r = draft.recipients[i]!;
      if (r.campaignId !== campaignId || r.email !== email || r.unsubscribedAt) continue;
      draft.recipients[i] = { ...r, unsubscribedAt: now };
      newlyMarked = true;
    }
    if (!newlyMarked) return;
    const bIdx = draft.campaigns.findIndex((b) => b.id === campaignId);
    if (bIdx >= 0) {
      const stats = draft.campaigns[bIdx]!.stats;
      draft.campaigns[bIdx] = {
        ...draft.campaigns[bIdx]!,
        stats: { ...stats, unsubscribed: stats.unsubscribed + 1 },
      };
    }
  });
}

export function lookupUnsubscribeContact(campaignId: string, token: string) {
  return findContactForBroadcast(campaignId, token);
}

export function performBroadcastUnsubscribe(
  campaignId: string,
  token: string,
): { ok: true; email: string; listName: string } | { ok: false } {
  const { broadcast, contact } = findContactForBroadcast(campaignId, token);
  if (!contact || !broadcast) return { ok: false };

  const now = new Date().toISOString();
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "unsubscribed", {
    sourceCampaignId: campaignId,
  });
  recordUnsubscribeOnRecipients(campaignId, contact.email, now);

  return {
    ok: true,
    email: contact.email,
    listName: broadcast.name ?? "this list",
  };
}

export function resubscribeBroadcastContact(campaignId: string, token: string): boolean {
  const { broadcast, contact } = findContactForBroadcast(campaignId, token);
  if (!contact || !broadcast) return false;
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "active");
  return true;
}
