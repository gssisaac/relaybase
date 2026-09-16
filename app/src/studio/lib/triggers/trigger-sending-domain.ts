import type { TriggerSource } from "@/lib/studio/api";
import { domainOf } from "@/studio/lib/triggers/trigger-account-cmd-groups";

export function sendingDomainFromTrigger(trigger: {
  domain: string;
  fromEmail: string | null;
  source: TriggerSource;
}): string {
  const t = trigger.source;
  if (t.type === "mailbox_inbound" && t.domain.trim()) {
    return t.domain.trim().toLowerCase();
  }
  if (trigger.fromEmail?.includes("@")) {
    return domainOf(trigger.fromEmail);
  }
  return trigger.domain.trim().toLowerCase();
}

export function resolveTriggerSendingDomain(
  trigger: {
    domain: string;
    fromEmail: string | null;
    source: TriggerSource;
  },
  draftFromEmail: string | null,
): string | null {
  if (draftFromEmail?.includes("@")) {
    return domainOf(draftFromEmail);
  }
  const fallback = sendingDomainFromTrigger(trigger);
  return fallback || null;
}
