import type { Automation, AutomationTrigger } from "@/lib/crm/api";

export function automationTriggerSummary(trigger: AutomationTrigger): string {
  switch (trigger.type) {
    case "internal_event":
      return trigger.event === "account.verify_email"
        ? "Verify email"
        : "Account created";
    case "form_submit":
      return `Form · ${trigger.formKey}`;
    case "http_webhook":
      return "Webhook";
    case "mailbox_inbound":
      return `Inbox · ${trigger.localPart}@${trigger.domain}`;
    default:
      return "Trigger";
  }
}

export function automationStatsLine(row: Automation): string {
  const { stats, status } = row;
  if (status === "draft") return "Draft — configure trigger and activate";
  const parts: string[] = [];
  if (stats.triggered > 0) parts.push(`${stats.triggered} triggered`);
  if (stats.delivered > 0) {
    parts.push(`${stats.delivered} delivered`);
    if (stats.opened > 0) {
      parts.push(`${stats.opened} opened`);
    }
  } else if (stats.sent > 0) {
    parts.push(`${stats.sent} sent`);
  }
  if (stats.skipped > 0) parts.push(`${stats.skipped} skipped`);
  return parts.length ? parts.join(" · ") : "No sends yet";
}
