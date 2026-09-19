import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Trigger } from "../../db/types";

export function isEmailSuppressedForTrigger(
  automation: Trigger,
  email: string,
): boolean {
  if (!automation.applyMarketingSuppression) return false;
  const normalized = email.trim().toLowerCase();
  const data = store.read();
  return data.accountSuppressions.some((s) => {
    if (s.accountLinkId !== DEV_ACCOUNT_LINK_ID || s.email !== normalized) return false;
    if (!s.subscriberGroupId) return true;
    if (automation.subscriberGroupId && s.subscriberGroupId === automation.subscriberGroupId) {
      return true;
    }
    return false;
  });
}
