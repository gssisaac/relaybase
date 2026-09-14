import type { Broadcast, BroadcastStats, Recipient, TrackingEvent } from "../db/types";
import { emptyBroadcastStats } from "./broadcast-stats";

export type SerializedBroadcast = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  audienceGroupId: string | null;
  audienceGroupName: string | null;
  audienceGroupDomain: string | null;
  domain: string | null;
  audienceContactCount: number | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  defaultTemplateId: string | null;
  listStatus: string;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  templateId: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  stats: BroadcastStats;
  audienceActiveCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountSentOverview = {
  period: { from: string; to: string };
  totals: BroadcastStats & { broadcasts: number };
  rates: { delivery: number; open: number; click: number; bounce: number };
  byWeek: { weekStart: string; sent: number; opened: number; clicked: number }[];
  byAudience: {
    audienceGroupId: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
  }[];
  broadcasts: Array<{
    id: string;
    name: string;
    subject: string;
    status: Broadcast["status"];
    sentAt: string | null;
    finishedAt: string | null;
    stats: BroadcastStats;
    audienceGroupName: string | null;
  }>;
  topLinks: { url: string; clicks: number; uniqueClicks: number; broadcastId: string }[];
};

export type InProgressOverview = {
  sending: Array<{
    broadcast: SerializedBroadcast;
    queue: {
      total: number;
      queued: number;
      sending: number;
      processed: number;
      skipped: number;
    };
    startedAt: string | null;
    lastDispatchedAt: string | null;
    recentEvents: Array<{
      id: string;
      recipientId: string;
      memberEmail: string;
      type: TrackingEvent["type"];
      url: string | null;
      reason: string | null;
      occurredAt: string;
    }>;
  }>;
  scheduled: SerializedBroadcast[];
};

function weekStartUtc(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function rate(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

export function buildSentOverview(input: {
  broadcasts: Broadcast[];
  recipients: Recipient[];
  trackingEvents: TrackingEvent[];
  audienceNameById: Map<string, string>;
}): AccountSentOverview {
  const sentRows = input.broadcasts
    .filter((b) => b.status === "sent" || b.status === "failed")
    .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt));

  const totals = emptyBroadcastStats();
  let broadcastsCount = 0;
  for (const row of sentRows) {
    broadcastsCount += 1;
    totals.sent += row.stats.sent;
    totals.delivered += row.stats.delivered;
    totals.bounced += row.stats.bounced;
    totals.failed += row.stats.failed;
    totals.skipped += row.stats.skipped;
    totals.complained += row.stats.complained;
    totals.opened += row.stats.opened;
    totals.totalOpens += row.stats.totalOpens;
    totals.clicked += row.stats.clicked;
    totals.totalClicks += row.stats.totalClicks;
    totals.unsubscribed += row.stats.unsubscribed;
  }

  const timestamps = sentRows
    .map((b) => b.sentAt ?? b.finishedAt ?? b.createdAt)
    .filter(Boolean)
    .sort();
  const period = {
    from: timestamps[0] ?? new Date().toISOString(),
    to: timestamps[timestamps.length - 1] ?? new Date().toISOString(),
  };

  const weekMap = new Map<string, { weekStart: string; sent: number; opened: number; clicked: number }>();
  for (const row of sentRows) {
    const when = row.sentAt ?? row.finishedAt ?? row.createdAt;
    const weekStart = weekStartUtc(when);
    const bucket = weekMap.get(weekStart) ?? { weekStart, sent: 0, opened: 0, clicked: 0 };
    bucket.sent += row.stats.sent;
    bucket.opened += row.stats.opened;
    bucket.clicked += row.stats.clicked;
    weekMap.set(weekStart, bucket);
  }

  const audienceMap = new Map<
    string,
    { audienceGroupId: string; name: string; sent: number; opened: number; clicked: number }
  >();
  for (const row of sentRows) {
    const id = row.audienceGroupId || "unknown";
    const name = input.audienceNameById.get(id) ?? "Unknown audience";
    const bucket = audienceMap.get(id) ?? { audienceGroupId: id, name, sent: 0, opened: 0, clicked: 0 };
    bucket.sent += row.stats.sent;
    bucket.opened += row.stats.opened;
    bucket.clicked += row.stats.clicked;
    audienceMap.set(id, bucket);
  }

  const sentIds = new Set(sentRows.map((b) => b.id));
  const linkMap = new Map<
    string,
    { url: string; clicks: number; unique: Set<string>; broadcastId: string }
  >();
  for (const event of input.trackingEvents) {
    if (!sentIds.has(event.broadcastId) || event.type !== "click" || !event.url) continue;
    const key = `${event.broadcastId}::${event.url}`;
    let row = linkMap.get(key);
    if (!row) {
      row = { url: event.url, clicks: 0, unique: new Set(), broadcastId: event.broadcastId };
      linkMap.set(key, row);
    }
    row.clicks += 1;
    row.unique.add(event.recipientId);
  }

  return {
    period,
    totals: { ...totals, broadcasts: broadcastsCount },
    rates: {
      delivery: rate(totals.delivered, totals.sent || totals.delivered + totals.bounced + totals.failed),
      open: rate(totals.opened, totals.delivered),
      click: rate(totals.clicked, totals.delivered),
      bounce: rate(totals.bounced, totals.sent || totals.delivered + totals.bounced + totals.failed),
    },
    byWeek: [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    byAudience: [...audienceMap.values()].sort((a, b) => b.sent - a.sent || a.name.localeCompare(b.name)),
    broadcasts: sentRows.map((row) => ({
      id: row.id,
      name: row.name,
      subject: row.subject,
      status: row.status,
      sentAt: row.sentAt ?? null,
      finishedAt: row.finishedAt ?? null,
      stats: row.stats,
      audienceGroupName: input.audienceNameById.get(row.audienceGroupId) ?? null,
    })),
    topLinks: [...linkMap.values()]
      .map((row) => ({
        url: row.url,
        clicks: row.clicks,
        uniqueClicks: row.unique.size,
        broadcastId: row.broadcastId,
      }))
      .sort((a, b) => b.clicks - a.clicks || a.url.localeCompare(b.url))
      .slice(0, 12),
  };
}

export function buildInProgressOverview(input: {
  sending: SerializedBroadcast[];
  scheduled: SerializedBroadcast[];
  recipients: Recipient[];
  trackingEvents: TrackingEvent[];
}): InProgressOverview {
  return {
    sending: input.sending.map((broadcast) => {
      const recips = input.recipients.filter((r) => r.broadcastId === broadcast.id);
      const queued = recips.filter((r) => r.status === "queued").length;
      const sending = recips.filter((r) => r.status === "sending").length;
      const processed = recips.filter(
        (r) => r.status === "delivered" || r.status === "bounced" || r.status === "failed",
      ).length;
      const skipped = recips.filter((r) => r.status === "skipped").length;
      const lastDispatchedAt =
        recips
          .map((r) => r.sentAt)
          .filter((v): v is string => Boolean(v))
          .sort()
          .at(-1) ?? null;
      const recentEvents = input.trackingEvents
        .filter((e) => e.broadcastId === broadcast.id)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 8)
        .map((e) => ({
          id: e.id,
          recipientId: e.recipientId,
          memberEmail: e.memberEmail,
          type: e.type,
          url: e.url ?? null,
          reason: e.reason ?? null,
          occurredAt: e.occurredAt,
        }));
      return {
        broadcast,
        queue: {
          total: recips.length,
          queued,
          sending,
          processed,
          skipped,
        },
        startedAt: broadcast.startedAt,
        lastDispatchedAt,
        recentEvents,
      };
    }),
    scheduled: input.scheduled,
  };
}
