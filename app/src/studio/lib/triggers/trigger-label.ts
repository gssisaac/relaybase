import type { Trigger, TriggerSource } from "@/studio/api";
import { formatRelativeDate } from "@/lib/utils";

/** Prefer last send time; fall back to last edit for list / sidebar timestamps. */
export function triggerListRelativeDate(row: Trigger): string {
  const iso = row.lastSentAt ?? row.updatedAt;
  return formatRelativeDate(iso);
}

export function triggerSourceSummary(source: TriggerSource): string {
  if (source.type === "mailbox_inbound") {
    return `Inbox · ${source.localPart}@${source.domain}`;
  }
  return `Webhook · ${source.emailPath || "email"}`;
}

export function triggerStatsLine(row: Trigger): string {
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
