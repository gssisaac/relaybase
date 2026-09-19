import { DEV_ACCOUNT_LINK_ID, studioService } from "@services/studio-service";
import type { Trigger, TriggerSource } from "@db/types";
import { triggerSource } from "@lib/messages/resolve";

function isActiveTrigger(row: Trigger): boolean {
  return row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.listStatus === "active" && row.status === "active";
}

export function findTriggerById(id: string): Trigger | undefined {
  return studioService.read().triggers.find((a) => a.id === id && a.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

export function findTriggerForInbound(input: {
  domain: string;
  localPart: string;
  subject?: string | null;
  fromEmail?: string | null;
}): Trigger | undefined {
  const domain = input.domain.trim().toLowerCase();
  const localPart = input.localPart.trim().toLowerCase();
  const subject = input.subject?.trim().toLowerCase() ?? "";
  const fromDomain = input.fromEmail?.split("@")[1]?.trim().toLowerCase() ?? "";

  const candidates = studioService
    .read()
    .triggers.filter((a): a is Trigger => {
      if (!isActiveTrigger(a)) return false;
      return triggerSource(a).type === "mailbox_inbound";
    })
    .filter((a) => {
      const source = triggerSource(a) as Extract<TriggerSource, { type: "mailbox_inbound" }>;
      return source.domain.toLowerCase() === domain;
    });

  const exact = candidates.filter((a) => {
    const source = triggerSource(a) as Extract<TriggerSource, { type: "mailbox_inbound" }>;
    return source.localPart === "*" || source.localPart.toLowerCase() === localPart;
  });
  if (!exact.length) return undefined;

  const narrowed = exact.filter((a) => {
    const source = triggerSource(a) as Extract<TriggerSource, { type: "mailbox_inbound" }>;
    const match = source.match;
    if (!match) return true;
    if (match.subjectContains?.trim()) {
      const needle = match.subjectContains.trim().toLowerCase();
      if (!subject.includes(needle)) return false;
    }
    if (match.fromDomain?.trim()) {
      const allowed = match.fromDomain.trim().toLowerCase();
      if (fromDomain !== allowed) return false;
    }
    return true;
  });

  if (narrowed.length === 1) return narrowed[0];
  if (narrowed.length > 1) {
    const nonWildcard = narrowed.find((a) => {
      const source = triggerSource(a) as Extract<TriggerSource, { type: "mailbox_inbound" }>;
      return source.localPart !== "*";
    });
    return nonWildcard ?? narrowed[0];
  }
  return undefined;
}
