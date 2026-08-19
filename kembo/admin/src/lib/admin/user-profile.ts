import type { StatsRange, StatsBucket } from "@/lib/admin/stats";
import { parseStatsRange } from "@/lib/admin/stats";
import {
  bucketIndex,
  createBuckets,
  incrementBucket,
  RANGE_MS,
} from "@/lib/admin/time-buckets";
import { readUserEmailData, resolveUserDomain } from "@/lib/dev-email-store";
import { getUser, type UserRecord } from "@/lib/users-store";
import type { EmailSenderLogEntry } from "@/relaybase/components/types";
import {
  listEmailSenderKeys,
  listEmailSenderLogs,
  type EmailSenderKey,
} from "@/relaybase/lib/client";
import { resolveEmailSenderConfig } from "@/relaybase/lib/config";
import { fetchDomainBrandingStatus } from "@/relaybase/lib/branding";
import {
  listAuthTokensFromWorker,
  type AuthTokenView,
} from "@/relaybase/lib/auth-token-client";

export type { StatsRange } from "@/lib/admin/stats";
export { parseStatsRange } from "@/lib/admin/stats";

export type UserBrandingSummary = {
  domain: string;
  dmarcEnforced: boolean;
  dnsConfigured: boolean;
};

export type UserApiKeySummary = {
  id: string;
  domain: string;
  label: string | null;
  keyPrefix: string;
  createdAt: string;
  active: boolean;
};

export type UserSummary = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  domain: string | null;
  authTokenCount: number;
  apiKeyCount: number;
  requests7d: number;
  errors7d: number;
  emails7d: number;
  branding: UserBrandingSummary | null;
};

export type UserDetail = UserSummary & {
  emailData: {
    addressCount: number;
    audienceCount: number;
    broadcastCount: number;
    localSentCount: number;
    relaybaseConfigured: boolean;
    cloudflareConfigured: boolean;
  };
  authTokens: AuthTokenView[];
  apiKeys: UserApiKeySummary[];
  brandingDetail: Awaited<ReturnType<typeof fetchDomainBrandingStatus>> | null;
  stats: UserBehaviorStats;
  workerConnected: boolean;
};

export type UserBehaviorStats = {
  range: StatsRange;
  totals: {
    requests: number;
    errors: number;
    emails: number;
    signIns: number;
  };
  series: {
    requests: StatsBucket[];
    errors: StatsBucket[];
    emails: StatsBucket[];
    activity: StatsBucket[];
  };
};

export type UserLogSummary = {
  total: number;
  failed: number;
  failedLast24h: number;
};

export type UserLogsResult = {
  logs: EmailSenderLogEntry[];
  summary: UserLogSummary;
  workerConnected: boolean;
};

async function authTokensForUser(
  userId: string,
): Promise<AuthTokenView[]> {
  const cfg = await resolveEmailSenderConfig();
  if (!cfg) return [];
  let tokens: AuthTokenView[];
  try {
    tokens = await listAuthTokensFromWorker(cfg);
  } catch {
    return [];
  }
  const needle = userId.toLowerCase();
  return tokens.filter((token) => {
    if (token.productId === userId) return true;
    if (!token.productId && token.label?.toLowerCase().includes(needle)) {
      return true;
    }
    return false;
  });
}

async function apiKeysForUser(
  userId: string,
  keys: EmailSenderKey[],
): Promise<UserApiKeySummary[]> {
  const domain = await resolveUserDomain(userId);
  const needle = userId.toLowerCase();

  return keys
    .filter((key) => {
      if (domain && key.domain.toLowerCase() === domain) return true;
      if (key.label?.toLowerCase().includes(needle)) return true;
      return false;
    })
    .map((key) => ({
      id: key.id,
      domain: key.domain,
      label: key.label,
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt,
      active: key.active,
    }));
}

function logBelongsToUser(
  log: EmailSenderLogEntry,
  userId: string,
  keyIds: Set<string>,
  domain: string | null,
): boolean {
  if (log.keyId && keyIds.has(log.keyId)) return true;
  if (domain && log.domain?.toLowerCase() === domain) return true;
  return false;
}

async function loadWorkerKeys(): Promise<EmailSenderKey[]> {
  const cfg = await resolveEmailSenderConfig();
  if (!cfg) return [];
  try {
    return await listEmailSenderKeys(cfg);
  } catch {
    return [];
  }
}

async function loadWorkerLogs(): Promise<EmailSenderLogEntry[]> {
  const cfg = await resolveEmailSenderConfig();
  if (!cfg) return [];
  try {
    const result = await listEmailSenderLogs(cfg, { limit: 500, status: "all" });
    return result.logs;
  } catch {
    return [];
  }
}

function countUserLogsInRange(
  logs: EmailSenderLogEntry[],
  userId: string,
  keyIds: Set<string>,
  domain: string | null,
  since: number,
): { requests: number; errors: number; emails: number } {
  let requests = 0;
  let errors = 0;
  let emails = 0;

  for (const log of logs) {
    if (!logBelongsToUser(log, userId, keyIds, domain)) continue;
    const ts = new Date(log.at).getTime();
    if (ts < since) continue;
    requests += 1;
    if (!log.ok) errors += 1;
    if (log.ok) emails += 1;
  }

  return { requests, errors, emails };
}

async function buildUserBehaviorStats(
  user: UserRecord,
  logs: EmailSenderLogEntry[],
  keyIds: Set<string>,
  domain: string | null,
  range: StatsRange,
  workerConnected: boolean,
): Promise<UserBehaviorStats> {
  const now = Date.now();
  const since = now - RANGE_MS[range];

  const requestBuckets = createBuckets(range, now);
  const errorBuckets = createBuckets(range, now);
  const emailBuckets = createBuckets(range, now);
  const activityBuckets = createBuckets(range, now);

  for (const log of logs) {
    if (!logBelongsToUser(log, user.id, keyIds, domain)) continue;
    const ts = new Date(log.at).getTime();
    if (ts < since) continue;
    const index = bucketIndex(ts, range, now);
    incrementBucket(requestBuckets, index);
    if (!log.ok) incrementBucket(errorBuckets, index);
    if (log.ok) incrementBucket(emailBuckets, index);
  }

  const lastSeenTs = new Date(user.lastSeenAt).getTime();
  if (lastSeenTs >= since) {
    incrementBucket(activityBuckets, bucketIndex(lastSeenTs, range, now));
  }

  if (!workerConnected) {
    const emailData = await readUserEmailData(user.id);
    for (const sent of emailData.sent) {
      const ts = new Date(sent.sentAt).getTime();
      if (ts < since) continue;
      incrementBucket(emailBuckets, bucketIndex(ts, range, now));
    }
  }

  return {
    range,
    totals: {
      requests: requestBuckets.reduce((sum, b) => sum + b.value, 0),
      errors: errorBuckets.reduce((sum, b) => sum + b.value, 0),
      emails: emailBuckets.reduce((sum, b) => sum + b.value, 0),
      signIns: activityBuckets.reduce((sum, b) => sum + b.value, 0),
    },
    series: {
      requests: requestBuckets,
      errors: errorBuckets,
      emails: emailBuckets,
      activity: activityBuckets,
    },
  };
}

async function brandingSummaryForUser(
  userId: string,
): Promise<UserBrandingSummary | null> {
  const domain = await resolveUserDomain(userId);
  if (!domain) return null;
  try {
    const status = await fetchDomainBrandingStatus(domain);
    return {
      domain: status.domain,
      dmarcEnforced: status.dmarcEnforced,
      dnsConfigured: status.dnsConfigured,
    };
  } catch {
    return {
      domain,
      dmarcEnforced: false,
      dnsConfigured: false,
    };
  }
}

export async function buildUserSummary(user: UserRecord): Promise<UserSummary> {
  const keys = await loadWorkerKeys();
  const logs = await loadWorkerLogs();
  const userKeys = await apiKeysForUser(user.id, keys);
  const keyIds = new Set(userKeys.map((key) => key.id));
  const domain = await resolveUserDomain(user.id);
  const since7d = Date.now() - RANGE_MS["7d"];
  const counts = countUserLogsInRange(logs, user.id, keyIds, domain, since7d);
  const workerConnected = (await resolveEmailSenderConfig()) !== null;
  const emailData = await readUserEmailData(user.id);
  const localSent7d = workerConnected
    ? 0
    : emailData.sent.filter(
        (entry) => new Date(entry.sentAt).getTime() >= since7d,
      ).length;

  return {
    id: user.id,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    domain,
    authTokenCount: (await authTokensForUser(user.id)).length,
    apiKeyCount: userKeys.length,
    requests7d: counts.requests,
    errors7d: counts.errors,
    emails7d: counts.emails + localSent7d,
    branding: await brandingSummaryForUser(user.id),
  };
}

export async function listUserSummaries(): Promise<UserSummary[]> {
  const { listUsers } = await import("@/lib/users-store");
  const users = await listUsers();
  return Promise.all(users.map((user) => buildUserSummary(user)));
}

export async function buildUserDetail(
  userId: string,
  range: StatsRange = "7d",
): Promise<UserDetail | null> {
  const user = await getUser(userId);
  if (!user) return null;

  const workerConnected = (await resolveEmailSenderConfig()) !== null;
  const keys = await loadWorkerKeys();
  const logs = await loadWorkerLogs();
  const userKeys = await apiKeysForUser(user.id, keys);
  const keyIds = new Set(userKeys.map((key) => key.id));
  const domain = await resolveUserDomain(user.id);
  const emailData = await readUserEmailData(user.id);
  const summary = await buildUserSummary(user);

  let brandingDetail = null;
  if (domain) {
    try {
      brandingDetail = await fetchDomainBrandingStatus(domain);
    } catch {
      brandingDetail = null;
    }
  }

  return {
    ...summary,
    emailData: {
      addressCount: emailData.addresses.length,
      audienceCount: emailData.audience.length,
      broadcastCount: emailData.broadcasts.length,
      localSentCount: emailData.sent.length,
      relaybaseConfigured: emailData.config.relaybaseConfigured,
      cloudflareConfigured: emailData.config.cloudflareConfigured,
    },
    authTokens: await authTokensForUser(user.id),
    apiKeys: userKeys,
    brandingDetail,
    stats: await buildUserBehaviorStats(
      user,
      logs,
      keyIds,
      domain,
      range,
      workerConnected,
    ),
    workerConnected,
  };
}

function summarizeUserLogs(logs: EmailSenderLogEntry[]): UserLogSummary {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let failed = 0;
  let failedLast24h = 0;

  for (const log of logs) {
    if (log.ok) continue;
    failed += 1;
    if (new Date(log.at).getTime() >= cutoff) {
      failedLast24h += 1;
    }
  }

  return { total: logs.length, failed, failedLast24h };
}

async function localSentAsLogs(
  userId: string,
): Promise<EmailSenderLogEntry[]> {
  const emailData = await readUserEmailData(userId);
  const domain = await resolveUserDomain(userId);

  return emailData.sent.map((sent) => ({
    id: `local:${sent.id}`,
    at: sent.sentAt,
    ok: true,
    status: 200,
    domain: domain ?? sent.from.split("@")[1]?.toLowerCase() ?? null,
    keyId: null,
    keyPrefix: null,
    keyLabel: "local",
    from: sent.from,
    to: sent.to,
    subject: sent.subject,
    messageId: sent.id,
  }));
}

export async function listUserLogs(
  userId: string,
  filters: {
    limit?: number;
    status?: "all" | "failed" | "success";
  } = {},
): Promise<UserLogsResult | null> {
  const user = await getUser(userId);
  if (!user) return null;

  const workerConnected = (await resolveEmailSenderConfig()) !== null;
  const keys = await loadWorkerKeys();
  const userKeys = await apiKeysForUser(userId, keys);
  const keyIds = new Set(userKeys.map((key) => key.id));
  const domain = await resolveUserDomain(userId);

  const workerLogs = await loadWorkerLogs();
  let logs = workerLogs.filter((log) =>
    logBelongsToUser(log, userId, keyIds, domain),
  );

  if (!workerConnected) {
    logs = [...logs, ...(await localSentAsLogs(userId))];
  }

  logs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const summary = summarizeUserLogs(logs);

  const status = filters.status ?? "all";
  if (status === "failed") {
    logs = logs.filter((log) => !log.ok);
  } else if (status === "success") {
    logs = logs.filter((log) => log.ok);
  }

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  logs = logs.slice(0, limit);

  return {
    logs,
    summary,
    workerConnected,
  };
}
