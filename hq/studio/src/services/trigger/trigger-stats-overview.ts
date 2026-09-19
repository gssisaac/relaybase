import type { TriggerStats, Trigger, TriggerEvent } from "@db/types";
import { normalizeTriggerStats } from "@services/trigger/stats";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

function rate(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function dayKeyUtc(iso: string): string {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function sumTriggerStats(rows: Trigger[]): TriggerStats & { triggers: number } {
  const totals = normalizeTriggerStats(undefined);
  let triggers = 0;
  for (const row of rows) {
    triggers += 1;
    const stats = normalizeTriggerStats(row.stats);
    totals.triggered += stats.triggered;
    totals.matched += stats.matched;
    totals.deduped += stats.deduped;
    totals.sent += stats.sent;
    totals.delivered += stats.delivered;
    totals.bounced += stats.bounced;
    totals.failed += stats.failed;
    totals.skipped += stats.skipped;
    totals.complained += stats.complained;
    totals.opened += stats.opened;
    totals.totalOpens += stats.totalOpens;
    totals.clicked += stats.clicked;
    totals.totalClicks += stats.totalClicks;
    totals.unsubscribed += stats.unsubscribed;
  }
  return { ...totals, triggers };
}

export type TriggerStatsOverview = {
  generatedAt: string;
  period: { from: string; to: string };
  triggers24h: number;
  triggers7d: number;
  totals: TriggerStats & { triggers: number };
  rates: { delivery: number; open: number; click: number; bounce: number };
  byDay: { day: string; label: string; count: number }[];
  byTrigger: Array<{
    id: string;
    name: string;
    status: Trigger["status"];
    stats: TriggerStats;
    triggers24h: number;
  }>;
  recentEvents: Array<{
    id: string;
    triggerId: string | null;
    triggerName: string;
    sourceType: TriggerEvent["triggerType"];
    recipientEmail: string;
    status: TriggerEvent["status"];
    occurredAt: string;
  }>;
};

export function buildTriggerStatsOverview(): TriggerStatsOverview {
  const data = readStudioDocument();
  const accountId = DEV_ACCOUNT_LINK_ID;
  const now = Date.now();
  const dayMs = 86_400_000;
  const since24h = new Date(now - dayMs).toISOString();
  const since7d = new Date(now - 7 * dayMs).toISOString();

  const automations = data.triggers.filter(
    (a) => a.accountLinkId === accountId && a.listStatus === "active",
  );
  const automationById = new Map(automations.map((a) => [a.id, a]));
  const triggerEvents = data.triggerEvents.filter((e) => e.accountLinkId === accountId);

  const events24h = triggerEvents.filter((e) => e.occurredAt >= since24h);
  const events7d = triggerEvents.filter((e) => e.occurredAt >= since7d);

  const triggers24hByAutomation = new Map<string, number>();
  for (const event of events24h) {
    if (!event.triggerId) continue;
    triggers24hByAutomation.set(
      event.triggerId,
      (triggers24hByAutomation.get(event.triggerId) ?? 0) + 1,
    );
  }

  const totals = sumTriggerStats(automations);
  const deliveryBase = totals.delivered || totals.sent;

  const triggerDayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const key = dayKeyUtc(new Date(now - i * dayMs).toISOString());
    triggerDayMap.set(key, 0);
  }
  for (const event of events7d) {
    const key = dayKeyUtc(event.occurredAt);
    if (!triggerDayMap.has(key)) continue;
    triggerDayMap.set(key, (triggerDayMap.get(key) ?? 0) + 1);
  }

  const byTrigger = automations
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      stats: normalizeTriggerStats(row.stats),
      triggers24h: triggers24hByAutomation.get(row.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.stats.triggered - a.stats.triggered ||
        b.triggers24h - a.triggers24h ||
        a.name.localeCompare(b.name),
    );

  const recentEvents = [...triggerEvents]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 50)
    .map((row) => {
      const automation = row.triggerId ? automationById.get(row.triggerId) : undefined;
      return {
        id: row.id,
        triggerId: row.triggerId,
        triggerName: automation?.name ?? "Unknown trigger",
        sourceType: row.triggerType,
        recipientEmail: row.recipientEmail,
        status: row.status,
        occurredAt: row.occurredAt,
      };
    });

  const oldestEvent = triggerEvents.reduce<string | null>((min, row) => {
    if (!min || row.occurredAt < min) return row.occurredAt;
    return min;
  }, null);

  return {
    generatedAt: new Date(now).toISOString(),
    period: {
      from: oldestEvent ?? new Date(now).toISOString(),
      to: new Date(now).toISOString(),
    },
    triggers24h: events24h.length,
    triggers7d: events7d.length,
    totals,
    rates: {
      delivery: rate(totals.delivered, totals.sent),
      open: rate(totals.opened, deliveryBase),
      click: rate(totals.clicked, deliveryBase),
      bounce: rate(totals.bounced, totals.sent),
    },
    byDay: [...triggerDayMap.entries()].map(([day, count]) => ({
      day,
      label: formatDayLabel(day),
      count,
    })),
    byTrigger,
    recentEvents,
  };
}
