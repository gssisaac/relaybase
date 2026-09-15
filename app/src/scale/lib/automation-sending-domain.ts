import type { AutomationTrigger } from "@/lib/scale/api";
import { domainOf } from "@/scale/lib/automation-account-cmd-groups";

export function sendingDomainFromAutomation(automation: {
  domain: string;
  fromEmail: string | null;
  trigger: AutomationTrigger;
}): string {
  const t = automation.trigger;
  if (t.type === "mailbox_inbound" && t.domain.trim()) {
    return t.domain.trim().toLowerCase();
  }
  if (automation.fromEmail?.includes("@")) {
    return domainOf(automation.fromEmail);
  }
  return automation.domain.trim().toLowerCase();
}

export function resolveAutomationSendingDomain(
  automation: {
    domain: string;
    fromEmail: string | null;
    trigger: AutomationTrigger;
  },
  draftFromEmail: string | null,
): string | null {
  if (draftFromEmail?.includes("@")) {
    return domainOf(draftFromEmail);
  }
  const fallback = sendingDomainFromAutomation(automation);
  return fallback || null;
}
