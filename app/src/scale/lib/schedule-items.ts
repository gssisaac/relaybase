import type { Campaign } from "@/lib/scale/api";
import { dateKeyInTimeZone } from "./schedule-timezone";

export type ScheduleItemKind = "campaign";

export type ScheduleItem = {
  id: string;
  kind: ScheduleItemKind;
  campaignId: string;
  title: string;
  subject: string;
  audienceLabel: string | null;
  recipientCount: number;
  at: Date;
  atIso: string;
  status: Campaign["status"];
};

export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return dateKeyLocal(a) === dateKeyLocal(b);
}

/** Merge campaign lists (later entries win) for API + overview responses. */
export function mergeCampaignSnapshots(...lists: Campaign[][]): Campaign[] {
  const byId = new Map<string, Campaign>();
  for (const list of lists) {
    for (const row of list) byId.set(row.id, row);
  }
  return [...byId.values()];
}

/** Upcoming scheduled campaigns, oldest first. */
export function upcomingCampaignScheduleItems(
  campaigns: Campaign[],
  now: Date = new Date(),
): ScheduleItem[] {
  const nowMs = now.getTime();
  const items: ScheduleItem[] = [];

  for (const b of campaigns) {
    if (b.listStatus === "archived") continue;
    if (b.status !== "scheduled" || !b.scheduledAt) continue;
    const at = new Date(b.scheduledAt);
    if (Number.isNaN(at.getTime()) || at.getTime() < nowMs) continue;

    items.push({
      id: `campaign:${b.id}`,
      kind: "campaign",
      campaignId: b.id,
      title: b.name.trim() || "Untitled campaign",
      subject: b.subject.trim() || "(No subject)",
      audienceLabel: b.audienceGroupName,
      recipientCount: b.audienceContactCount ?? b.audienceActiveCount,
      at,
      atIso: b.scheduledAt,
      status: b.status,
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return items;
}

export function scheduleItemsByDayKey(
  items: ScheduleItem[],
  timeZone?: string,
): Map<string, ScheduleItem[]> {
  const keyFor = timeZone
    ? (d: Date) => dateKeyInTimeZone(d, timeZone)
    : (d: Date) => dateKeyLocal(d);
  const map = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = keyFor(item.at);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}
