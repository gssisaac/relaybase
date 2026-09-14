import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceGroup, BroadcastMember } from "../db/types";
import {
  audienceMemberStatusForBroadcast,
} from "./audience-send-status";
import { newId, newToken } from "./ids";

export function findAudienceGroup(groupId: string): AudienceGroup | undefined {
  return store
    .read()
    .audienceGroups.find((g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

/** Materialize broadcast audience rows from a linked audience group's contacts. */
export function syncBroadcastAudienceFromGroup(
  broadcastId: string,
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
    for (const member of group.contacts) {
      const email = member.email.trim().toLowerCase();
      if (!email.includes("@")) {
        skipped += 1;
        continue;
      }
      const name = member.name?.trim() || null;

      let idx = draft.broadcastMembers.findIndex(
        (s) => s.broadcastId === broadcastId && s.audienceMemberId === member.id,
      );
      if (idx < 0) {
        idx = draft.broadcastMembers.findIndex(
          (s) => s.broadcastId === broadcastId && s.email === email,
        );
      }

      const contactStatus = audienceMemberStatusForBroadcast(member.sendStatus);

      if (idx < 0) {
        const created: BroadcastMember = {
          id: newId("member"),
          accountLinkId: DEV_ACCOUNT_LINK_ID,
          broadcastId,
          audienceMemberId: member.id,
          email,
          name,
          status: contactStatus,
          source: "audience_group",
          unsubscribeToken: newToken(),
          unsubscribedAt: contactStatus === "unsubscribed" ? now : null,
          bouncedAt: null,
          bounceReason: null,
          createdAt: now,
          updatedAt: now,
        };
        draft.broadcastMembers.push(created);
        added += 1;
        continue;
      }

      const existing = draft.broadcastMembers[idx]!;
      if (existing.status === "bounced") {
        skipped += 1;
        continue;
      }

      draft.broadcastMembers[idx] = {
        ...existing,
        audienceMemberId: member.id,
        email,
        name: name ?? existing.name,
        source: "audience_group",
        status: contactStatus,
        unsubscribedAt: contactStatus === "unsubscribed" ? existing.unsubscribedAt ?? now : null,
        updatedAt: now,
      };
      updated += 1;
    }
  });

  return { added, updated, skipped };
}

export function syncAllBroadcastsForAudienceGroup(groupId: string): void {
  const broadcastIds = store
    .read()
    .broadcasts.filter(
      (b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID && b.audienceGroupId === groupId,
    )
    .map((b) => b.id);
  for (const broadcastId of broadcastIds) {
    syncBroadcastAudienceFromGroup(broadcastId, groupId);
  }
}
