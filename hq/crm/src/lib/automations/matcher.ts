import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Automation, AutomationTrigger, InternalAutomationEvent } from "../../db/types";

function isActiveAutomation(row: Automation): boolean {
  return row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.listStatus === "active" && row.status === "active";
}

export function findAutomationById(id: string): Automation | undefined {
  return store.read().automations.find((a) => a.id === id && a.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

export function findAutomationByFormKey(formKey: string): Automation | undefined {
  const key = formKey.trim();
  return store
    .read()
    .automations.find(
      (a) =>
        isActiveAutomation(a) &&
        a.trigger.type === "form_submit" &&
        a.trigger.formKey === key,
    );
}

export function findAutomationByInternalEvent(event: InternalAutomationEvent): Automation | undefined {
  return store
    .read()
    .automations.find(
      (a) =>
        isActiveAutomation(a) &&
        a.trigger.type === "internal_event" &&
        a.trigger.event === event,
    );
}

export function findAutomationForInbound(input: {
  domain: string;
  localPart: string;
  subject?: string | null;
  fromEmail?: string | null;
}): Automation | undefined {
  const domain = input.domain.trim().toLowerCase();
  const localPart = input.localPart.trim().toLowerCase();
  const subject = input.subject?.trim().toLowerCase() ?? "";
  const fromDomain = input.fromEmail?.split("@")[1]?.trim().toLowerCase() ?? "";

  const candidates = store
    .read()
    .automations.filter(
      (a): a is Automation & { trigger: Extract<AutomationTrigger, { type: "mailbox_inbound" }> } =>
        isActiveAutomation(a) && a.trigger.type === "mailbox_inbound",
    )
    .filter((a) => a.trigger.domain.toLowerCase() === domain);

  const exact = candidates.filter(
    (a) => a.trigger.localPart === "*" || a.trigger.localPart.toLowerCase() === localPart,
  );
  if (!exact.length) return undefined;

  const narrowed = exact.filter((a) => {
    const match = a.trigger.match;
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
    const nonWildcard = narrowed.find((a) => a.trigger.localPart !== "*");
    return nonWildcard ?? narrowed[0];
  }
  return undefined;
}
