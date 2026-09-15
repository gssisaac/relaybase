import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { AccountSuppressionReason } from "../../db/types";
import { newId } from "../shared/ids";

export function normalizeSuppressionEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True if this email must not receive mail for the given audience group. */
export function isEmailSuppressedForGroup(
  email: string,
  audienceGroupId: string,
  accountLinkId: string = DEV_ACCOUNT_LINK_ID,
): boolean {
  const normalized = normalizeSuppressionEmail(email);
  return store.read().accountSuppressions.some((s) => {
    if (s.accountLinkId !== accountLinkId) return false;
    if (s.email !== normalized) return false;
    if (s.audienceGroupId === null) return true;
    return s.audienceGroupId === audienceGroupId;
  });
}

export function upsertAccountSuppression(input: {
  email: string;
  reason: AccountSuppressionReason;
  audienceGroupId: string | null;
  sourceBroadcastId?: string | null;
  accountLinkId?: string;
}): void {
  const accountLinkId = input.accountLinkId ?? DEV_ACCOUNT_LINK_ID;
  const email = normalizeSuppressionEmail(input.email);
  const now = new Date().toISOString();

  store.update((draft) => {
    const existing = draft.accountSuppressions.find(
      (s) =>
        s.accountLinkId === accountLinkId &&
        s.email === email &&
        s.audienceGroupId === input.audienceGroupId &&
        s.reason === input.reason,
    );
    if (existing) return;

    draft.accountSuppressions.push({
      id: newId("suppression"),
      accountLinkId,
      email,
      reason: input.reason,
      audienceGroupId: input.audienceGroupId,
      sourceBroadcastId: input.sourceBroadcastId ?? null,
      createdAt: now,
    });
  });
}

/** Record group unsubscribe + durable suppression ledger entry. */
export function recordGroupUnsubscribe(input: {
  audienceGroupId: string;
  email: string;
  sourceBroadcastId?: string | null;
}): void {
  upsertAccountSuppression({
    email: input.email,
    reason: "unsubscribe",
    audienceGroupId: input.audienceGroupId,
    sourceBroadcastId: input.sourceBroadcastId ?? null,
  });
}
