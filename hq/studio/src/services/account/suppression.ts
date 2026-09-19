import type { AccountSuppressionReason } from "@db/types";
import { newId } from "@lib/shared/ids";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export function normalizeSuppressionEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True if this email must not receive mail for the given subscriber group. */
export function isEmailSuppressedForGroup(
  email: string,
  subscriberGroupId: string,
  accountLinkId: string = DEV_ACCOUNT_LINK_ID,
): boolean {
  const normalized = normalizeSuppressionEmail(email);
  return readStudioDocument().accountSuppressions.some((s) => {
    if (s.accountLinkId !== accountLinkId) return false;
    if (s.email !== normalized) return false;
    if (s.subscriberGroupId === null) return true;
    return s.subscriberGroupId === subscriberGroupId;
  });
}

export function upsertAccountSuppression(input: {
  email: string;
  reason: AccountSuppressionReason;
  subscriberGroupId: string | null;
  sourceNewsletterId?: string | null;
  accountLinkId?: string;
}): void {
  const accountLinkId = input.accountLinkId ?? DEV_ACCOUNT_LINK_ID;
  const email = normalizeSuppressionEmail(input.email);
  const now = new Date().toISOString();

  mutateStudioDocument((draft) => {
    const existing = draft.accountSuppressions.find(
      (s) =>
        s.accountLinkId === accountLinkId &&
        s.email === email &&
        s.subscriberGroupId === input.subscriberGroupId &&
        s.reason === input.reason,
    );
    if (existing) return;

    draft.accountSuppressions.push({
      id: newId("suppression"),
      accountLinkId,
      email,
      reason: input.reason,
      subscriberGroupId: input.subscriberGroupId,
      sourceNewsletterId: input.sourceNewsletterId ?? null,
      createdAt: now,
    });
  });
}

/** Record group unsubscribe + durable suppression ledger entry. */
export function recordGroupUnsubscribe(input: {
  subscriberGroupId: string;
  email: string;
  sourceNewsletterId?: string | null;
}): void {
  upsertAccountSuppression({
    email: input.email,
    reason: "unsubscribe",
    subscriberGroupId: input.subscriberGroupId,
    sourceNewsletterId: input.sourceNewsletterId ?? null,
  });
}
