import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Automation } from "../../db/types";

export function isEmailSuppressedForAutomation(
  automation: Automation,
  email: string,
): boolean {
  if (!automation.applyMarketingSuppression) return false;
  const normalized = email.trim().toLowerCase();
  const data = store.read();
  return data.accountSuppressions.some((s) => {
    if (s.accountLinkId !== DEV_ACCOUNT_LINK_ID || s.email !== normalized) return false;
    if (!s.audienceGroupId) return true;
    if (automation.audienceGroupId && s.audienceGroupId === automation.audienceGroupId) {
      return true;
    }
    return false;
  });
}
