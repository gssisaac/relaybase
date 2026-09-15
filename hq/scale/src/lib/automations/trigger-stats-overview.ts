import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Automation, AutomationStats, AutomationTriggerEvent } from "../../db/types";
import { normalizeAutomationStats } from "./stats";

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

function sumAutomationStats(rows: Automation[]): AutomationStats & { automations: number } {
  const totals = normalizeAutomationStats(undefined);
  let automations = 0;
  for (const row of rows) {
    automations += 1;
    const stats = normalizeAutomationStats(row.stats);
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
  return { ...totals, automations };
}

export type AutomationTriggerStatsOverview = {
  generatedAt: string;
  period: { from: string; to: string };
  triggers24h: number;
  triggers7d: number;
  totals: AutomationStats & { automations: number };
  rates: { delivery: number; open: number; click: number; bounce: number };
  byDay: { day: string; label: string; count: number }[];
  byAutomation: Array<{
    id: string;
    name: string;
    status: Automation["status"];
    stats: AutomationStats;
    triggers24h: number;
  }>;
  recentEvents: Array<{
    id: string;
    automationId: string | null;
    automationName: string;
    triggerType: AutomationTriggerEvent["triggerType"];
    recipientEmail: string;
    status: AutomationTriggerEvent["status"];
    occurredAt: string;
  }>;
};

export function buildAutomationTriggerStatsOverview(): AutomationTriggerStatsOverview {
  const data = store.read();
  const accountId = DEV_ACCOUNT_LINK_ID;
  const now = Date.now();
  const dayMs = 86_400_000;
  const since24h = new Date(now - dayMs).toISOString();
  const since7d = new Date(now - 7 * dayMs).toISOString();

  const automations = data.automations.filter(
    (a) => a.accountLinkId === accountId && a.listStatus === "active",
  );
  const automationById = new Map(automations.map((a) => [a.id, a]));
  const triggerEvents = data.triggerEvents.filter((e) => e.accountLinkId === accountId);

  const events24h = triggerEvents.filter((e) => e.occurredAt >= since24h);
  const events7d = triggerEvents.filter((e) => e.occurredAt >= since7d);

  const triggers24hByAutomation = new Map<string, number>();
  for (const event of events24h) {
    if (!event.automationId) continue;
    triggers24hByAutomation.set(
      event.automationId,
      (triggers24hByAutomation.get(event.automationId) ?? 0) + 1,
    );
  }

  const totals = sumAutomationStats(automations);
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

  const byAutomation = automations
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      stats: normalizeAutomationStats(row.stats),
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
      const automation = row.automationId ? automationById.get(row.automationId) : undefined;
      return {
        id: row.id,
        automationId: row.automationId,
        automationName: automation?.name ?? "Unknown automation",
        triggerType: row.triggerType,
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
    byAutomation,
    recentEvents,
  };
}
