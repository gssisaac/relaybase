import type { StatsBucket } from "@/lib/admin/time-buckets";
import {
  bucketIndex,
  createBuckets,
  incrementBucket,
  RANGE_MS,
} from "@/lib/admin/time-buckets";
import { listUsers } from "@/lib/users-store";
import {
  listEmailSenderLogs,
  type EmailSenderLogsResult,
} from "@/relaybase/lib/client";
import { resolveEmailSenderConfig } from "@/relaybase/lib/config";
import {
  listEmailSenderSentEmails,
  listRelaybaseDashboardAuthTokens,
  readEmailSenderSettings,
} from "@/relaybase/lib/settings";
import type { EmailSenderLogEntry } from "@/relaybase/components/types";

export type StatsRange = "24h" | "7d" | "30d" | "90d";

export type { StatsBucket };

export type AdminStatsSeries = {
  users: StatsBucket[];
  authTokens: StatsBucket[];
  apiKeysUsed: StatsBucket[];
  requests: StatsBucket[];
  errors: StatsBucket[];
  emails: StatsBucket[];
};

export type AdminStats = {
  range: StatsRange;
  workerConnected: boolean;
  totals: {
    users: number;
    authTokens: number;
    apiKeysIssued: number;
    apiKeysUsed: number;
    requests: number;
    errors: number;
    emails: number;
  };
  series: AdminStatsSeries;
};

export function parseStatsRange(value: string | null): StatsRange {
  if (value === "24h" || value === "7d" || value === "30d" || value === "90d") {
    return value;
  }
  return "7d";
}

async function loadSendLogs(): Promise<EmailSenderLogEntry[]> {
  const cfg = resolveEmailSenderConfig();
  if (!cfg) return [];
  try {
    const result: EmailSenderLogsResult = await listEmailSenderLogs(cfg, {
      limit: 500,
      status: "all",
    });
    return result.logs;
  } catch {
    return [];
  }
}

export async function collectAdminStats(
  range: StatsRange,
): Promise<AdminStats> {
  const now = Date.now();
  const since = now - RANGE_MS[range];

  const users = listUsers();
  const authTokens = listRelaybaseDashboardAuthTokens();
  const apiKeysIssued = readEmailSenderSettings().apiKeyVault.length;
  const sentEmails = listEmailSenderSentEmails();
  const logs = await loadSendLogs();
  const workerConnected = resolveEmailSenderConfig() !== null;

  const userBuckets = createBuckets(range, now);
  const authTokenBuckets = createBuckets(range, now);
  const apiKeyBuckets = createBuckets(range, now);
  const requestBuckets = createBuckets(range, now);
  const errorBuckets = createBuckets(range, now);
  const emailBuckets = createBuckets(range, now);

  for (const user of users) {
    const ts = new Date(user.createdAt).getTime();
    incrementBucket(userBuckets, bucketIndex(ts, range, now));
  }

  for (const token of authTokens) {
    const ts = new Date(token.createdAt).getTime();
    incrementBucket(authTokenBuckets, bucketIndex(ts, range, now));
  }

  const keysUsedInRange = new Set<string>();
  const keysByBucket = new Map<number, Set<string>>();

  for (const log of logs) {
    const ts = new Date(log.at).getTime();
    if (ts < since) continue;

    const index = bucketIndex(ts, range, now);
    incrementBucket(requestBuckets, index);
    if (!log.ok) incrementBucket(errorBuckets, index);
    if (log.ok) incrementBucket(emailBuckets, index);

    if (log.keyId) {
      keysUsedInRange.add(log.keyId);
      if (index !== null) {
        const set = keysByBucket.get(index) ?? new Set<string>();
        set.add(log.keyId);
        keysByBucket.set(index, set);
      }
    }
  }

  if (!workerConnected) {
    for (const sent of sentEmails) {
      const ts = new Date(sent.sentAt).getTime();
      if (ts < since) continue;
      incrementBucket(emailBuckets, bucketIndex(ts, range, now));
    }
  }

  for (const [index, keys] of keysByBucket) {
    if (index >= 0 && index < apiKeyBuckets.length) {
      apiKeyBuckets[index].value = keys.size;
    }
  }

  return {
    range,
    workerConnected,
    totals: {
      users: users.length,
      authTokens: authTokens.length,
      apiKeysIssued,
      apiKeysUsed: keysUsedInRange.size,
      requests: requestBuckets.reduce((sum, b) => sum + b.value, 0),
      errors: errorBuckets.reduce((sum, b) => sum + b.value, 0),
      emails: emailBuckets.reduce((sum, b) => sum + b.value, 0),
    },
    series: {
      users: userBuckets,
      authTokens: authTokenBuckets,
      apiKeysUsed: apiKeyBuckets,
      requests: requestBuckets,
      errors: errorBuckets,
      emails: emailBuckets,
    },
  };
}
