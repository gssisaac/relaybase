import type { Broadcast } from "@/lib/scale/api";

export type ScheduleItemKind = "broadcast";

export type ScheduleItem = {
  id: string;
  kind: ScheduleItemKind;
  broadcastId: string;
  title: string;
  subject: string;
  audienceLabel: string | null;
  at: Date;
  atIso: string;
  status: Broadcast["status"];
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

/** Merge broadcast lists (later entries win) for API + overview responses. */
export function mergeBroadcastSnapshots(...lists: Broadcast[][]): Broadcast[] {
  const byId = new Map<string, Broadcast>();
  for (const list of lists) {
    for (const row of list) byId.set(row.id, row);
  }
  return [...byId.values()];
}

/** Upcoming scheduled broadcasts, oldest first. */
export function upcomingBroadcastScheduleItems(
  broadcasts: Broadcast[],
  now: Date = new Date(),
): ScheduleItem[] {
  const nowMs = now.getTime();
  const items: ScheduleItem[] = [];

  for (const b of broadcasts) {
    if (b.listStatus === "archived") continue;
    if (b.status !== "scheduled" || !b.scheduledAt) continue;
    const at = new Date(b.scheduledAt);
    if (Number.isNaN(at.getTime()) || at.getTime() < nowMs) continue;

    items.push({
      id: `broadcast:${b.id}`,
      kind: "broadcast",
      broadcastId: b.id,
      title: b.name.trim() || "Untitled broadcast",
      subject: b.subject.trim() || "(No subject)",
      audienceLabel: b.audienceGroupName,
      at,
      atIso: b.scheduledAt,
      status: b.status,
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return items;
}

export function scheduleItemsByDayKey(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = dateKeyLocal(item.at);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}
