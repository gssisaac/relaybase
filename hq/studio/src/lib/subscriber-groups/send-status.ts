import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { SubscriberSendStatus } from "../../db/types";
import { normalizeSuppressionEmail, recordGroupUnsubscribe } from "../account/suppression";

export function setSubscriberContactSendStatus(
  groupId: string,
  subscriberMemberId: string,
  sendStatus: Extract<SubscriberSendStatus, "active" | "unsubscribed">,
  opts?: { sourceNewsletterId?: string | null },
): void {
  const now = new Date().toISOString();
  let email: string | null = null;
  store.update((draft) => {
    const gIdx = draft.subscriberGroups.findIndex(
      (g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (gIdx < 0) return;
    const cIdx = draft.subscriberGroups[gIdx]!.contacts.findIndex((c) => c.id === subscriberMemberId);
    if (cIdx < 0) return;
    email = draft.subscriberGroups[gIdx]!.contacts[cIdx]!.email;
    draft.subscriberGroups[gIdx]!.contacts[cIdx] = {
      ...draft.subscriberGroups[gIdx]!.contacts[cIdx]!,
      sendStatus,
      unsubscribedAt: sendStatus === "unsubscribed" ? now : null,
    };
  });
  if (!email) return;

  if (sendStatus === "unsubscribed") {
    recordGroupUnsubscribe({
      subscriberGroupId: groupId,
      email,
      sourceNewsletterId: opts?.sourceNewsletterId ?? null,
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
          s.subscriberGroupId === groupId &&
          s.reason === "unsubscribe"
        ),
    );
  });
}

export function markSubscriberContactBounced(
  groupId: string,
  email: string,
  detail?: string,
): void {
  const now = new Date().toISOString();
  const normalized = email.trim().toLowerCase();
  store.update((draft) => {
    const gIdx = draft.subscriberGroups.findIndex(
      (g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (gIdx < 0) return;
    const cIdx = draft.subscriberGroups[gIdx]!.contacts.findIndex((c) => c.email === normalized);
    if (cIdx < 0) return;
    draft.subscriberGroups[gIdx]!.contacts[cIdx] = {
      ...draft.subscriberGroups[gIdx]!.contacts[cIdx]!,
      sendStatus: "bounced",
      bouncedAt: now,
      bounceReason: detail ?? "hard_bounce",
    };
  });
}
