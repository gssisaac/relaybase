import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { BroadcastMember } from "../db/types";

/** Keep audience contact sendStatus and all linked broadcast members in sync. */
export function setAudienceContactSendStatus(
  groupId: string,
  audienceMemberId: string,
  sendStatus: "active" | "unsubscribed",
): void {
  const now = new Date().toISOString();
  store.update((draft) => {
    const gIdx = draft.audienceGroups.findIndex(
      (g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (gIdx >= 0) {
      const cIdx = draft.audienceGroups[gIdx]!.contacts.findIndex((c) => c.id === audienceMemberId);
      if (cIdx >= 0) {
        draft.audienceGroups[gIdx]!.contacts[cIdx] = {
          ...draft.audienceGroups[gIdx]!.contacts[cIdx]!,
          sendStatus,
          unsubscribedAt: sendStatus === "unsubscribed" ? now : null,
        };
      }
    }

    const broadcastIds = new Set(
      draft.broadcasts
        .filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID && b.audienceGroupId === groupId)
        .map((b) => b.id),
    );

    for (let i = 0; i < draft.broadcastMembers.length; i += 1) {
      const bm = draft.broadcastMembers[i]!;
      if (bm.audienceMemberId !== audienceMemberId || !broadcastIds.has(bm.broadcastId)) continue;
      if (bm.status === "bounced") continue;
      draft.broadcastMembers[i] = {
        ...bm,
        status: sendStatus,
        unsubscribedAt: sendStatus === "unsubscribed" ? now : null,
        updatedAt: now,
      };
    }
  });
}

export function syncAudienceSendStatusFromBroadcastMember(member: BroadcastMember): void {
  if (!member.audienceMemberId) return;
  const broadcast = store.read().broadcasts.find((b) => b.id === member.broadcastId);
  if (!broadcast?.audienceGroupId) return;
  if (member.status === "unsubscribed") {
    setAudienceContactSendStatus(broadcast.audienceGroupId, member.audienceMemberId, "unsubscribed");
  } else if (member.status === "active") {
    setAudienceContactSendStatus(broadcast.audienceGroupId, member.audienceMemberId, "active");
  }
}

export function audienceMemberStatusForBroadcast(
  sendStatus: "active" | "unsubscribed" | undefined,
): "active" | "unsubscribed" {
  return sendStatus === "unsubscribed" ? "unsubscribed" : "active";
}
