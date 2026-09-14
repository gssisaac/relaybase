import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceSendStatus } from "../db/types";
import { normalizeSuppressionEmail, recordGroupUnsubscribe } from "./account-suppression";

export function setAudienceContactSendStatus(
  groupId: string,
  audienceMemberId: string,
  sendStatus: Extract<AudienceSendStatus, "active" | "unsubscribed">,
  opts?: { sourceBroadcastId?: string | null },
): void {
  const now = new Date().toISOString();
  let email: string | null = null;
  store.update((draft) => {
    const gIdx = draft.audienceGroups.findIndex(
      (g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (gIdx < 0) return;
    const cIdx = draft.audienceGroups[gIdx]!.contacts.findIndex((c) => c.id === audienceMemberId);
    if (cIdx < 0) return;
    email = draft.audienceGroups[gIdx]!.contacts[cIdx]!.email;
    draft.audienceGroups[gIdx]!.contacts[cIdx] = {
      ...draft.audienceGroups[gIdx]!.contacts[cIdx]!,
      sendStatus,
      unsubscribedAt: sendStatus === "unsubscribed" ? now : null,
    };
  });
  if (!email) return;

  if (sendStatus === "unsubscribed") {
    recordGroupUnsubscribe({
      audienceGroupId: groupId,
      email,
      sourceBroadcastId: opts?.sourceBroadcastId ?? null,
    });
    return;
  }

  const normalized = normalizeSuppressionEmail(email);
  store.update((draft) => {
    draft.accountSuppressions = draft.accountSuppressions.filter(
      (s) =>
        !(
          s.accountLinkId === DEV_ACCOUNT_LINK_ID &&
          s.email === normalized &&
          s.audienceGroupId === groupId &&
          s.reason === "unsubscribe"
        ),
    );
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
