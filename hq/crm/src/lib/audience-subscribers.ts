import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceGroup, Subscriber } from "../db/types";
import { newId, newToken } from "./ids";

export function findAudienceGroup(groupId: string): AudienceGroup | undefined {
  return store
    .read()
    .audienceGroups.find((g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

/** Materialize campaign consent rows from an audience group's contacts. */
export function syncCampaignSubscribersFromAudienceGroup(
  campaignId: string,
  groupId: string,
): { added: number; updated: number; skipped: number } {
  const group = findAudienceGroup(groupId);
  if (!group) {
    return { added: 0, updated: 0, skipped: 0 };
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  store.update((draft) => {
    const seenMemberIds = new Set<string>();
    for (const member of group.contacts) {
      const email = member.email.trim().toLowerCase();
      if (!email.includes("@")) {
        skipped += 1;
        continue;
      }
      seenMemberIds.add(member.id);
      const name = member.name?.trim() || null;

      let idx = draft.subscribers.findIndex(
        (s) => s.campaignId === campaignId && s.audienceMemberId === member.id,
      );
      if (idx < 0) {
        idx = draft.subscribers.findIndex(
          (s) => s.campaignId === campaignId && s.email === email,
        );
      }

      if (idx < 0) {
        const created: Subscriber = {
          id: newId("subscriber"),
          accountLinkId: DEV_ACCOUNT_LINK_ID,
          campaignId,
          audienceMemberId: member.id,
          email,
          name,
          status: "subscribed",
          source: "audience_group",
          unsubscribeToken: newToken(),
          unsubscribedAt: null,
          bouncedAt: null,
          bounceReason: null,
          createdAt: now,
          updatedAt: now,
        };
        draft.subscribers.push(created);
        added += 1;
        continue;
      }

      const existing = draft.subscribers[idx]!;
      if (existing.status === "unsubscribed" || existing.status === "bounced") {
        skipped += 1;
        continue;
      }

      draft.subscribers[idx] = {
        ...existing,
        audienceMemberId: member.id,
        email,
        name: name ?? existing.name,
        source: "audience_group",
        updatedAt: now,
      };
      updated += 1;
    }
  });

  return { added, updated, skipped };
}

export function syncAllCampaignsForAudienceGroup(groupId: string): void {
  const campaignIds = store
    .read()
    .campaigns.filter(
      (c) => c.accountLinkId === DEV_ACCOUNT_LINK_ID && c.audienceGroupId === groupId,
    )
    .map((c) => c.id);
  for (const campaignId of campaignIds) {
    syncCampaignSubscribersFromAudienceGroup(campaignId, groupId);
  }
}
