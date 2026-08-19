import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { readAudienceCatalog } from "../../lib/catalog-audience";
import { readBroadcasts } from "../../lib/catalog-broadcasts";
import { readMailbox } from "../../lib/catalog-store";
import { listInboundEmails, MAX_MESSAGES } from "../../lib/inbound-store";
import { listKeys } from "../../lib/keys";
import { listSendLogs, type SendLogEntry } from "../../lib/send-logs";
import {
  bucketIndex,
  createBuckets,
  incrementBucket,
  parseStatsRange,
  RANGE_MS,
  type StatsBucket,
} from "../../lib/stats-buckets";

const consoleStats = new Hono<{ Bindings: Env }>();

function isApiSend(log: SendLogEntry): boolean {
  return Boolean(log.keyId);
}

function domainFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

function inboundMatchesEmail(
  message: {
    toEmail?: string | null;
    toEmails?: string[] | null;
    ccEmails?: string[] | null;
  },
  email: string,
): boolean {
  const needle = email.trim().toLowerCase();
  if (!needle) return false;
  const addrs = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) addrs.add(trimmed);
  };
  add(message.toEmail);
  for (const to of message.toEmails ?? []) add(to);
  for (const cc of message.ccEmails ?? []) add(cc);
  return addrs.has(needle);
}

function sumBuckets(buckets: StatsBucket[]): number {
  return buckets.reduce((sum, b) => sum + b.value, 0);
}

consoleStats.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const range = parseStatsRange(c.req.query("range"));
  const domain = c.req.query("domain")?.trim().toLowerCase() || null;
  const now = Date.now();
  const since = now - RANGE_MS[range];

  const [mailbox, audience, broadcasts, sendLogs, keys] = await Promise.all([
    readMailbox(c.env.RELAYBASE_APP),
    readAudienceCatalog(c.env.RELAYBASE_APP),
    readBroadcasts(c.env.RELAYBASE_APP),
    listSendLogs(c.env.INBOUND, { limit: 500, domain: domain ?? undefined }),
    listKeys(c.env.RELAYBASE_APP),
  ]);

  const addresses = domain
    ? mailbox.addresses.filter((a) => a.domain === domain)
    : mailbox.addresses;
  const contacts = domain
    ? audience.contacts.filter((ct) => ct.domain === domain)
    : audience.contacts;
  const domainBroadcasts = domain
    ? broadcasts.filter((b) => b.domain === domain)
    : broadcasts;
  const domainKeys = domain
    ? keys.filter((k) => k.domain === domain)
    : keys;

  const sentBuckets = createBuckets(range, now);
  const requestBuckets = createBuckets(range, now);
  const errorBuckets = createBuckets(range, now);
  const apiEmailBuckets = createBuckets(range, now);
  const apiKeyBuckets = createBuckets(range, now);
  const keysUsedInRange = new Set<string>();
  const keysByBucket = new Map<number, Set<string>>();

  for (const log of sendLogs.logs) {
    const ts = new Date(log.at).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    const index = bucketIndex(ts, range, now);
    incrementBucket(sentBuckets, index);
    incrementBucket(requestBuckets, index);
    if (!log.ok) incrementBucket(errorBuckets, index);
    if (isApiSend(log) && log.ok) incrementBucket(apiEmailBuckets, index);
    if (log.keyId) {
      keysUsedInRange.add(log.keyId);
      if (index !== null) {
        const set = keysByBucket.get(index) ?? new Set<string>();
        set.add(log.keyId);
        keysByBucket.set(index, set);
      }
    }
  }

  for (const [index, used] of keysByBucket) {
    if (index >= 0 && index < apiKeyBuckets.length) {
      apiKeyBuckets[index].value = used.size;
    }
  }

  const drafts = domainBroadcasts.filter((b) => b.status === "draft").length;

  return c.json({
    domain,
    range,
    workerConnected: true,
    totals: {
      domains: domain ? 1 : mailbox.domains.length,
      addresses: addresses.length,
      audience: contacts.length,
      broadcasts: domainBroadcasts.length,
      drafts,
      sent: sumBuckets(sentBuckets),
      apiKeys: domainKeys.length,
      apiKeysUsed: keysUsedInRange.size,
      requests: sumBuckets(requestBuckets),
      errors: sumBuckets(errorBuckets),
      apiEmails: sumBuckets(apiEmailBuckets),
    },
    series: {
      sent: sentBuckets,
      apiKeysUsed: apiKeyBuckets,
      requests: requestBuckets,
      errors: errorBuckets,
      apiEmails: apiEmailBuckets,
    },
  });
});

consoleStats.get("/account-stats", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);

  const range = parseStatsRange(c.req.query("range"));
  const now = Date.now();
  const since = now - RANGE_MS[range];
  const domain = domainFromEmail(email);

  const [mailbox, sendLogs, inbound] = await Promise.all([
    readMailbox(c.env.RELAYBASE_APP),
    listSendLogs(c.env.INBOUND, { limit: 500 }),
    domain
      ? listInboundEmails(c.env.INBOUND, { domain, limit: MAX_MESSAGES })
      : Promise.resolve([]),
  ]);

  const address = mailbox.addresses.find((a) => a.email === email);
  const fromLogs = sendLogs.logs.filter(
    (l) => l.from?.toLowerCase() === email,
  );
  const receivedMessages = inbound.filter((m) =>
    inboundMatchesEmail(m, email),
  );

  const receivedBuckets = createBuckets(range, now);
  const sentBuckets = createBuckets(range, now);
  const apiEmailBuckets = createBuckets(range, now);
  const apiErrorBuckets = createBuckets(range, now);
  const apiRequestBuckets = createBuckets(range, now);

  for (const message of receivedMessages) {
    const ts = new Date(message.receivedAt).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    incrementBucket(receivedBuckets, bucketIndex(ts, range, now));
  }

  for (const log of fromLogs) {
    const ts = new Date(log.at).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    const index = bucketIndex(ts, range, now);
    incrementBucket(sentBuckets, index);
    if (isApiSend(log)) {
      incrementBucket(apiRequestBuckets, index);
      if (log.ok) incrementBucket(apiEmailBuckets, index);
      else incrementBucket(apiErrorBuckets, index);
    }
  }

  return c.json({
    email,
    displayName: address?.displayName ?? null,
    domain: address?.domain ?? domain,
    range,
    totals: {
      received: sumBuckets(receivedBuckets),
      sent: sumBuckets(sentBuckets),
      apiRequests: sumBuckets(apiRequestBuckets),
      apiEmails: sumBuckets(apiEmailBuckets),
      apiErrors: sumBuckets(apiErrorBuckets),
    },
    series: {
      received: receivedBuckets,
      sent: sentBuckets,
      apiEmails: apiEmailBuckets,
      apiErrors: apiErrorBuckets,
    },
  });
});

consoleStats.get("/account-logs", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);

  const status = (c.req.query("status")?.trim().toLowerCase() ||
    "all") as "all" | "failed" | "success";
  const limit = Math.min(
    Math.max(Number(c.req.query("limit") ?? 50) || 50, 1),
    200,
  );
  const domain = domainFromEmail(email);

  const [sendLogs, inbound] = await Promise.all([
    listSendLogs(c.env.INBOUND, { limit: 500 }),
    domain
      ? listInboundEmails(c.env.INBOUND, { domain, limit: MAX_MESSAGES })
      : Promise.resolve([]),
  ]);

  type LogRow = {
    id: string;
    at: string;
    source: "api" | "dashboard" | "inbound";
    direction: "sent" | "received";
    ok: boolean;
    from: string;
    to: string;
    subject: string;
    error?: string;
    keyPrefix?: string | null;
    keyLabel?: string | null;
    status?: number | null;
  };

  const rows: LogRow[] = [];

  for (const log of sendLogs.logs) {
    if (log.from?.toLowerCase() !== email) continue;
    rows.push({
      id: log.id,
      at: log.at,
      source: isApiSend(log) ? "api" : "dashboard",
      direction: "sent",
      ok: log.ok,
      from: log.from ?? email,
      to: log.to ?? "",
      subject: log.subject ?? "",
      ...(log.error ? { error: log.error } : {}),
      keyPrefix: log.keyPrefix,
      keyLabel: log.keyLabel,
      status: log.status,
    });
  }

  for (const message of inbound) {
    if (!inboundMatchesEmail(message, email)) continue;
    rows.push({
      id: message.id,
      at: message.receivedAt,
      source: "inbound",
      direction: "received",
      ok: true,
      from: message.fromEmail ?? "",
      to: email,
      subject: message.subject ?? "",
      status: null,
    });
  }

  rows.sort((a, b) => b.at.localeCompare(a.at));

  const filtered =
    status === "failed"
      ? rows.filter((r) => !r.ok)
      : status === "success"
        ? rows.filter((r) => r.ok)
        : rows;

  const summarySource = filtered;
  const summary = {
    total: summarySource.length,
    success: summarySource.filter((r) => r.ok).length,
    failed: summarySource.filter((r) => !r.ok).length,
    api: summarySource.filter((r) => r.source === "api").length,
    dashboard: summarySource.filter((r) => r.source === "dashboard").length,
    inbound: summarySource.filter((r) => r.source === "inbound").length,
  };

  return c.json({
    summary,
    logs: filtered.slice(0, limit),
    workerConnected: true,
  });
});

export { consoleStats };
