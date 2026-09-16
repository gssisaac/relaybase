import { store } from "../../db/store";
import type { Trigger, TriggerSource } from "../../db/types";
import { requireMessage, triggerSource } from "../messages/resolve";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TriggerActivationIssue = { field: string; message: string };

export function validateTriggerSource(trigger: TriggerSource): TriggerActivationIssue[] {
  const issues: TriggerActivationIssue[] = [];
  switch (trigger.type) {
    case "http_webhook":
      if (!trigger.secret?.trim()) {
        issues.push({ field: "trigger.secret", message: "Webhook secret is required" });
      }
      if (!trigger.emailPath?.trim()) {
        issues.push({ field: "trigger.emailPath", message: "Email field path is required" });
      }
      break;
    case "form_submit":
      if (!trigger.formKey?.trim()) {
        issues.push({ field: "trigger.formKey", message: "Form key is required" });
      }
      if (!trigger.emailPath?.trim()) {
        issues.push({ field: "trigger.emailPath", message: "Email field path is required" });
      }
      break;
    case "mailbox_inbound":
      if (!trigger.domain?.trim()) {
        issues.push({ field: "trigger.domain", message: "Domain is required" });
      }
      if (!trigger.localPart?.trim()) {
        issues.push({ field: "trigger.localPart", message: "Local-part is required" });
      }
      break;
    case "internal_event":
      if (!trigger.event) {
        issues.push({ field: "trigger.event", message: "Internal event is required" });
      }
      break;
    default:
      break;
  }
  return issues;
}

export function validateTriggerForActivation(automation: Trigger): TriggerActivationIssue[] {
  const issues: TriggerActivationIssue[] = [];
  const message = requireMessage(store.read(), automation.templateId);
  if (!message.subject.trim()) {
    issues.push({ field: "subject", message: "Subject is required" });
  }
  if (!message.bodyMarkdown.trim() && !message.layoutId) {
    issues.push({ field: "bodyMarkdown", message: "Email body or template is required" });
  }
  if (!automation.domain.trim()) {
    issues.push({ field: "domain", message: "Sending domain is required" });
  }
  if (!automation.fromEmail?.trim() || !EMAIL_RE.test(automation.fromEmail.trim())) {
    issues.push({ field: "fromEmail", message: "Valid from address is required" });
  }
  issues.push(...validateTriggerSource(triggerSource(automation)));
  return issues;
}
