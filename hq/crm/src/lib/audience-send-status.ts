import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceSendStatus } from "../db/types";

export function setAudienceContactSendStatus(
  groupId: string,
  audienceMemberId: string,
  sendStatus: Extract<AudienceSendStatus, "active" | "unsubscribed">,
): void {
  const now = new Date().toISOString();
  store.update((draft) => {
    const gIdx = draft.audienceGroups.findIndex(
      (g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (gIdx < 0) return;
    const cIdx = draft.audienceGroups[gIdx]!.contacts.findIndex((c) => c.id === audienceMemberId);
    if (cIdx < 0) return;
    draft.audienceGroups[gIdx]!.contacts[cIdx] = {
      ...draft.audienceGroups[gIdx]!.contacts[cIdx]!,
      sendStatus,
      unsubscribedAt: sendStatus === "unsubscribed" ? now : null,
    };
  });
}

export function markAudienceContactBounced(
  groupId: string,
  email: string,
  detail?: string,
): void {
  const now = new Date().toISOString();
  const normalized = email.trim().toLowerCase();
  store.update((draft) => {
    const gIdx = draft.audienceGroups.findIndex(
      (g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (gIdx < 0) return;
    const cIdx = draft.audienceGroups[gIdx]!.contacts.findIndex((c) => c.email === normalized);
    if (cIdx < 0) return;
    draft.audienceGroups[gIdx]!.contacts[cIdx] = {
      ...draft.audienceGroups[gIdx]!.contacts[cIdx]!,
      sendStatus: "bounced",
      bouncedAt: now,
      bounceReason: detail ?? "hard_bounce",
    };
  });
}
