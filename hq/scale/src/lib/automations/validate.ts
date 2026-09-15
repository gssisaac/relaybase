import type { Automation, AutomationTrigger } from "../../db/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AutomationActivationIssue = { field: string; message: string };

export function validateAutomationTrigger(trigger: AutomationTrigger): AutomationActivationIssue[] {
  const issues: AutomationActivationIssue[] = [];
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

export function validateAutomationForActivation(automation: Automation): AutomationActivationIssue[] {
  const issues: AutomationActivationIssue[] = [];
  if (!automation.subject.trim()) {
    issues.push({ field: "subject", message: "Subject is required" });
  }
  if (!automation.bodyMarkdown.trim() && !automation.templateId) {
    issues.push({ field: "bodyMarkdown", message: "Email body or template is required" });
  }
  if (!automation.domain.trim()) {
    issues.push({ field: "domain", message: "Sending domain is required" });
  }
  if (!automation.fromEmail?.trim() || !EMAIL_RE.test(automation.fromEmail.trim())) {
    issues.push({ field: "fromEmail", message: "Valid from address is required" });
  }
  issues.push(...validateAutomationTrigger(automation.trigger));
  return issues;
}
