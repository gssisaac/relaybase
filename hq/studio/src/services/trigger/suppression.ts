import type { Trigger } from "@db/types";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export function isEmailSuppressedForTrigger(
  automation: Trigger,
  email: string,
): boolean {
  if (!automation.applyMarketingSuppression) return false;
  const normalized = email.trim().toLowerCase();
  const data = readStudioDocument();
  return data.accountSuppressions.some((s) => {
    if (s.accountLinkId !== DEV_ACCOUNT_LINK_ID || s.email !== normalized) return false;
    if (!s.subscriberGroupId) return true;
    if (automation.subscriberGroupId && s.subscriberGroupId === automation.subscriberGroupId) {
      return true;
    }
    return false;
  });
}
