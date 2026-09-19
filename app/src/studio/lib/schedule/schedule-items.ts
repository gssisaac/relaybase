import type { Newsletter } from "@/studio/api";
import { dateKeyInTimeZone } from "./schedule-timezone";

export type ScheduleItemKind = "newsletter";

export type ScheduleItem = {
  id: string;
  kind: ScheduleItemKind;
  newsletterId: string;
  title: string;
  subject: string;
  subscriberGroupLabel: string | null;
  recipientCount: number;
  at: Date;
  atIso: string;
  status: Newsletter["status"];
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

/** Merge newsletter lists (later entries win) for API + overview responses. */
export function mergeNewsletterSnapshots(...lists: Newsletter[][]): Newsletter[] {
  const byId = new Map<string, Newsletter>();
  for (const list of lists) {
    for (const row of list) byId.set(row.id, row);
  }
  return [...byId.values()];
}

/** Upcoming scheduled newsletters, oldest first. */
export function upcomingNewsletterScheduleItems(
  newsletters: Newsletter[],
  now: Date = new Date(),
): ScheduleItem[] {
  const nowMs = now.getTime();
  const items: ScheduleItem[] = [];

  for (const b of newsletters) {
    if (b.listStatus === "archived") continue;
    if (b.status !== "scheduled" || !b.scheduledAt) continue;
    const at = new Date(b.scheduledAt);
    if (Number.isNaN(at.getTime()) || at.getTime() < nowMs) continue;

    items.push({
      id: `newsletter:${b.id}`,
      kind: "newsletter",
      newsletterId: b.id,
      title: b.subject.trim() || "(No subject)",
      subject: b.subject.trim() || "(No subject)",
      subscriberGroupLabel: b.subscriberGroupName,
      recipientCount: b.subscriberContactCount ?? b.subscriberActiveCount,
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
