import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Broadcast } from "../../db/types";
import { audienceGroupToSummary } from "../audience-groups/api-serialize";
import { buildSentOverview } from "../broadcasts/overview";
import { serializeBroadcast } from "../broadcasts/serialize";

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

function openRateForBroadcast(row: Broadcast): number {
  return rate(row.stats.opened, row.stats.delivered);
}

function clickRateForBroadcast(row: Broadcast): number {
  return rate(row.stats.clicked, row.stats.delivered);
}

export function buildScaleOverview() {
  const data = store.read();
  const accountId = DEV_ACCOUNT_LINK_ID;
  const now = Date.now();
  const dayMs = 86_400_000;
  const since24h = new Date(now - dayMs).toISOString();
  const since7d = new Date(now - 7 * dayMs).toISOString();
  const since30d = new Date(now - 30 * dayMs).toISOString();
  const in7d = new Date(now + 7 * dayMs).toISOString();

  const broadcasts = data.broadcasts.filter((b) => b.accountLinkId === accountId && b.listStatus === "active");
  const automations = data.automations.filter((a) => a.accountLinkId === accountId && a.listStatus === "active");
  const groups = data.audienceGroups.filter((g) => g.accountLinkId === accountId);
  const triggerEvents = data.triggerEvents.filter((e) => e.accountLinkId === accountId);

  const audienceNameById = new Map(groups.map((g) => [g.id, g.name]));

  const sentOverview = buildSentOverview({
    broadcasts,
    recipients: data.recipients,
    trackingEvents: data.trackingEvents,
    audienceNameById,
  });

  let monthlySentVolume = 0;
  for (const row of broadcasts) {
    if (row.status !== "sent" && row.status !== "failed") continue;
    const when = row.sentAt ?? row.finishedAt ?? row.createdAt;
    if (when >= since30d) monthlySentVolume += row.stats.sent;
  }

  let totalContacts = 0;
  let healthActive = 0;
  let healthUnsubscribed = 0;
  let healthBounced = 0;
  for (const group of groups) {
    for (const contact of group.contacts) {
      totalContacts += 1;
      if (contact.sendStatus === "unsubscribed") healthUnsubscribed += 1;
      else if (contact.sendStatus === "bounced") healthBounced += 1;
      else healthActive += 1;
    }
  }

  const scheduledRows = broadcasts
    .filter((b) => b.status === "scheduled" || b.status === "sending")
    .map((row) => serializeBroadcast(row))
    .sort((a, b) => {
      const aAt = a.scheduledAt ?? a.startedAt ?? a.updatedAt;
      const bAt = b.scheduledAt ?? b.startedAt ?? b.updatedAt;
      return aAt.localeCompare(bAt);
    });

  const upcomingIn7d = scheduledRows.filter((row) => {
    const at = row.scheduledAt ?? row.startedAt;
    if (!at) return row.status === "sending";
    return at <= in7d;
  });

  const nextRow = scheduledRows.find((row) => {
    if (row.status === "sending") return true;
    const at = row.scheduledAt;
    return at && new Date(at).getTime() >= now;
  });

  const nextUpcoming = nextRow
    ? {
        id: nextRow.id,
        name: nextRow.name,
        subject: nextRow.subject,
        scheduledAt: nextRow.scheduledAt ?? nextRow.startedAt ?? nextRow.updatedAt,
        audienceGroupName: nextRow.audienceGroupName,
        recipientCount: nextRow.audienceContactCount ?? nextRow.audienceActiveCount ?? 0,
        status: nextRow.status,
      }
    : null;

  const automationById = new Map(automations.map((a) => [a.id, a]));
  const events24h = triggerEvents.filter((e) => e.occurredAt >= since24h);
  const recentEvents = [...triggerEvents]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8)
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

  const draftCount = broadcasts.filter((b) => b.status === "draft").length;
  const inProgressCount = broadcasts.filter((b) => b.status === "scheduled" || b.status === "sending").length;

  const recentSent = broadcasts
    .filter((b) => b.status === "sent")
    .sort((a, b) => (b.sentAt ?? b.finishedAt ?? "").localeCompare(a.sentAt ?? a.finishedAt ?? ""))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      name: row.name,
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
  for (const send of data.automationSends) {
    if (!automationIds.has(send.automationId)) continue;
    if (dayKeyUtc(send.createdAt) !== todayKey) continue;
    usedToday += 1;
  }

  const failedSyncGroups = groups.filter((g) => g.dataSource && g.lastSyncStatus === "error").length;
  const lastSyncAt = groups
    .map((g) => g.lastSyncAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;

  const sendsByWeek = sentOverview.byWeek.slice(-8).map((row) => ({
    weekStart: row.weekStart,
    label: formatWeekLabel(row.weekStart),
    sent: row.sent,
    opened: row.opened,
    clicked: row.clicked,
  }));

  const audienceHealthChart = [
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
    summary: {
      totalContacts,
      activeAutomations: automations.filter((a) => a.status === "active").length,
      scheduledSends: scheduledRows.filter((r) => r.status === "scheduled").length,
      sendingNow: scheduledRows.filter((r) => r.status === "sending").length,
      monthlySentVolume,
      avgOpenRate: sentOverview.rates.open,
      avgClickRate: sentOverview.rates.click,
      deliverableRate,
    },
    schedule: {
      nextUpcoming,
      upcomingCount: upcomingIn7d.length,
      upcomingList: scheduledRows.slice(0, 6).map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        scheduledAt: row.scheduledAt ?? row.startedAt ?? row.updatedAt,
        status: row.status as "scheduled" | "sending",
        audienceGroupName: row.audienceGroupName,
      })),
    },
    automations: {
      totalCount: automations.length,
      activeCount: automations.filter((a) => a.status === "active").length,
      pausedCount: automations.filter((a) => a.status === "paused").length,
      draftCount: automations.filter((a) => a.status === "draft").length,
      triggers24h: events24h.length,
      recentEvents,
    },
    broadcasts: {
      draftCount,
      inProgressCount,
      recentSent,
      cloudflareQuota: {
        usedToday,
        dailyLimit: null,
        percentUsed: null,
      },
    },
    audience: {
      groupCount: groups.length,
      health: {
        active: healthActive,
        unsubscribed: healthUnsubscribed,
        bounced: healthBounced,
      },
      recentSyncStatus: {
        lastSyncAt,
        failedGroupsCount: failedSyncGroups,
      },
      groups: groups
        .map(audienceGroupToSummary)
        .sort((a, b) => b.contactCount - a.contactCount || a.name.localeCompare(b.name))
        .slice(0, 6),
    },
    charts: {
      sendsByWeek,
      audienceHealth: audienceHealthChart,
      automationTriggersByDay,
      engagementRates: engagementRatesChart,
    },
  };
}

export type ScaleOverviewPayload = ReturnType<typeof buildScaleOverview>;
