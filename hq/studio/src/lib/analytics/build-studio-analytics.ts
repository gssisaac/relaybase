import type { Newsletter } from "@db/types";
import { buildSentOverview } from "@lib/newsletters/overview";
import { requireMessage } from "@lib/messages/resolve";
import { templateCatalogStore } from "@lib/templates/template-catalog-store";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

function rate(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function startOfUtcDay(iso: string): string {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKeyUtc(iso: string): string {
  return startOfUtcDay(iso).slice(0, 10);
}

function formatWeekLabel(weekStartIso: string): string {
  const d = new Date(weekStartIso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function openRateForBroadcast(row: Newsletter): number {
  return rate(row.stats.opened, row.stats.delivered);
}

function clickRateForBroadcast(row: Newsletter): number {
  return rate(row.stats.clicked, row.stats.delivered);
}

export function buildStudioAnalytics() {
  const data = readStudioDocument();
  const accountId = DEV_ACCOUNT_LINK_ID;
  const now = Date.now();
  const dayMs = 86_400_000;
  const since24h = new Date(now - dayMs).toISOString();
  const since7d = new Date(now - 7 * dayMs).toISOString();
  const since30d = new Date(now - 30 * dayMs).toISOString();

  const broadcasts = data.newsletters.filter((b) => b.accountLinkId === accountId && b.listStatus === "active");
  const automations = data.triggers.filter((a) => a.accountLinkId === accountId && a.listStatus === "active");
  const groups = data.subscriberGroups.filter((g) => g.accountLinkId === accountId);
  const triggerEvents = data.triggerEvents.filter((e) => e.accountLinkId === accountId);

  const subscriberNameById = new Map(groups.map((g) => [g.id, g.name]));

  const sentOverview = buildSentOverview({
    newsletters: broadcasts,
    recipients: data.recipients,
    trackingEvents: data.trackingEvents,
    subscriberNameById,
  });

  let monthlySentVolume = 0;
  for (const row of broadcasts) {
    if (row.status !== "sent" && row.status !== "failed") continue;
    const when = row.sentAt ?? row.finishedAt ?? row.createdAt;
    if (when >= since30d) monthlySentVolume += row.stats.sent;
  }

  let totalContacts = 0;
  let healthActive = 0;
  for (const group of groups) {
    for (const contact of group.contacts) {
      totalContacts += 1;
      if (contact.sendStatus !== "unsubscribed" && contact.sendStatus !== "bounced") {
        healthActive += 1;
      }
    }
  }

  const scheduledRows = broadcasts.filter((b) => b.status === "scheduled" || b.status === "sending");

  const automationById = new Map(automations.map((a) => [a.id, a]));
  const events24h = triggerEvents.filter((e) => e.occurredAt >= since24h);
  const recentEvents = [...triggerEvents]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8)
    .map((row) => {
      const trigger = row.triggerId ? automationById.get(row.triggerId) : undefined;
      return {
        id: row.id,
        triggerId: row.triggerId,
        triggerName: trigger?.name ?? "Unknown trigger",
        sourceType: row.triggerType,
        recipientEmail: row.recipientEmail,
        status: row.status,
        occurredAt: row.occurredAt,
      };
    });

  const draftCount = broadcasts.filter((b) => b.status === "draft").length;
  const inProgressCount = scheduledRows.length;

  const recentSent = broadcasts
    .filter((b) => b.status === "sent")
    .sort((a, b) => (b.sentAt ?? b.finishedAt ?? "").localeCompare(a.sentAt ?? a.finishedAt ?? ""))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      subject: requireMessage(data, row.messageId).subject,
      sentAt: row.sentAt ?? row.finishedAt ?? row.createdAt,
      recipientCount: row.stats.sent,
      delivered: row.stats.delivered,
      openRate: openRateForBroadcast(row),
      clickRate: clickRateForBroadcast(row),
    }));

  const todayKey = dayKeyUtc(new Date(now).toISOString());
  let usedToday = 0;
  for (const row of broadcasts) {
    if (row.status !== "sent" && row.status !== "sending") continue;
    const when = row.sentAt ?? row.startedAt;
    if (!when || dayKeyUtc(when) !== todayKey) continue;
    usedToday += row.stats.sent;
  }
  const automationIds = new Set(automations.map((a) => a.id));
  for (const send of data.triggerSends) {
    if (!automationIds.has(send.triggerId)) continue;
    if (dayKeyUtc(send.createdAt) !== todayKey) continue;
    usedToday += 1;
  }

  const sendsByWeek = sentOverview.byWeek.slice(-8).map((row) => ({
    weekStart: row.weekStart,
    label: formatWeekLabel(row.weekStart),
    sent: row.sent,
    opened: row.opened,
    clicked: row.clicked,
  }));

  let healthUnsubscribed = 0;
  let healthBounced = 0;
  for (const group of groups) {
    for (const contact of group.contacts) {
      if (contact.sendStatus === "unsubscribed") healthUnsubscribed += 1;
      else if (contact.sendStatus === "bounced") healthBounced += 1;
    }
  }

  const subscriberHealthChart = [
    { key: "active", label: "Active", count: healthActive },
    { key: "unsubscribed", label: "Unsubscribed", count: healthUnsubscribed },
    { key: "bounced", label: "Bounced", count: healthBounced },
  ];

  const triggerDayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const key = dayKeyUtc(new Date(now - i * dayMs).toISOString());
    triggerDayMap.set(key, 0);
  }
  for (const event of triggerEvents) {
    if (event.occurredAt < since7d) continue;
    const key = dayKeyUtc(event.occurredAt);
    if (!triggerDayMap.has(key)) continue;
    triggerDayMap.set(key, (triggerDayMap.get(key) ?? 0) + 1);
  }
  const automationTriggersByDay = [...triggerDayMap.entries()].map(([day, count]) => ({
    day,
    label: formatDayLabel(day),
    count,
  }));

  const engagementRatesChart = [
    { key: "delivery", label: "Delivery", value: sentOverview.rates.delivery },
    { key: "open", label: "Open", value: sentOverview.rates.open },
    { key: "click", label: "Click", value: sentOverview.rates.click },
  ];

  const deliverableRate = rate(healthActive, totalContacts);

  return {
    generatedAt: new Date(now).toISOString(),
    templateCount: templateCatalogStore.listAll().length,
    summary: {
      totalContacts,
      activeTriggers: automations.filter((a) => a.status === "active").length,
      scheduledSends: scheduledRows.filter((r) => r.status === "scheduled").length,
      sendingNow: scheduledRows.filter((r) => r.status === "sending").length,
      monthlySentVolume,
      avgOpenRate: sentOverview.rates.open,
      avgClickRate: sentOverview.rates.click,
      deliverableRate,
    },
    triggers: {
      totalCount: automations.length,
      activeCount: automations.filter((a) => a.status === "active").length,
      pausedCount: automations.filter((a) => a.status === "paused").length,
      draftCount: automations.filter((a) => a.status === "draft").length,
      triggers24h: events24h.length,
      recentEvents,
    },
    newsletters: {
      draftCount,
      inProgressCount,
      recentSent,
      cloudflareQuota: {
        usedToday,
        dailyLimit: null,
        percentUsed: null,
      },
    },
    charts: {
      sendsByWeek,
      subscriberHealth: subscriberHealthChart,
      automationTriggersByDay,
      engagementRates: engagementRatesChart,
    },
  };
}

export type StudioAnalyticsPayload = ReturnType<typeof buildStudioAnalytics>;
