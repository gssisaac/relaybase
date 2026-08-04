import {
  preferRelaybaseApiKeyRecord,
  readRelaybaseApiKeyVault,
  removeRelaybaseApiKeyRecord,
  upsertRelaybaseApiKeyRecord,
  type RelaybaseApiKeyRecord,
} from "@/lib/relaybase/relaybase-settings";
import {
  createWorkerApiKey,
  deleteWorkerApiKey,
  listWorkerApiKeys,
  listWorkerSendLogs,
  readRelaybaseWorkerConfig,
  type WorkerApiKey,
  type WorkerSendLogEntry,
} from "@/lib/relaybase/worker-client";

export type StatsRange = "24h" | "7d" | "30d";

export type StatsBucket = {
  value: number;
  label: string;
};

export type UserApiKeyRow = {
  id: string;
  domain: string;
  label: string | null;
  keyPrefix: string;
  apiKey: string | null;
  active: boolean;
  createdAt: string;
  requests: number;
  errors: number;
  emails: number;
  requestSeries: StatsBucket[];
};

export type UserApiStats = {
  range: StatsRange;
  workerConnected: boolean;
  totals: {
    apiKeys: number;
    apiKeysUsed: number;
    requests: number;
    errors: number;
    emails: number;
  };
  series: {
    apiKeysUsed: StatsBucket[];
    requests: StatsBucket[];
    errors: StatsBucket[];
    emails: StatsBucket[];
  };
};

function rangeMs(range: StatsRange): number {
  if (range === "24h") return 24 * 60 * 60 * 1000;
  if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function bucketCount(range: StatsRange): number {
  if (range === "24h") return 24;
  if (range === "30d") return 30;
  return 7;
}

export function parseStatsRange(value: string | null): StatsRange {
  if (value === "24h" || value === "30d") return value;
  return "7d";
}

function createEmptyBuckets(range: StatsRange): StatsBucket[] {
  const count = bucketCount(range);
  return Array.from({ length: count }, (_, index) => ({
    value: 0,
    label: range === "24h" ? `${index}h` : `D${index + 1}`,
  }));
}

function bucketIndexFor(
  timestamp: number,
  range: StatsRange,
  now: number,
): number | null {
  const span = rangeMs(range);
  const count = bucketCount(range);
  const since = now - span;
  if (timestamp < since || timestamp > now) return null;
  const bucketMs = span / count;
  return Math.min(count - 1, Math.floor((timestamp - since) / bucketMs));
}

function domainSet(domains: string[]): Set<string> {
  return new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean));
}

function keyBelongsToUser(key: WorkerApiKey, domains: Set<string>): boolean {
  return domains.has(key.domain.trim().toLowerCase());
}

function logBelongsToUser(
  log: WorkerSendLogEntry,
  keyIds: Set<string>,
  domains: Set<string>,
): boolean {
  if (log.keyId && keyIds.has(log.keyId)) return true;
  if (log.domain && domains.has(log.domain.trim().toLowerCase())) return true;
  return false;
}

async function loadWorkerKeys(): Promise<WorkerApiKey[]> {
  const cfg = await readRelaybaseWorkerConfig();
  if (!cfg) return [];
  try {
    return await listWorkerApiKeys(cfg);
  } catch {
    return [];
  }
}

async function loadWorkerLogs(domain?: string | null): Promise<{
  logs: WorkerSendLogEntry[];
  workerConnected: boolean;
}> {
  const cfg = await readRelaybaseWorkerConfig();
  if (!cfg) return { logs: [], workerConnected: false };
  try {
    const result = await listWorkerSendLogs(cfg, {
      limit: 500,
      status: "all",
      domain: domain ?? undefined,
    });
    return { logs: result.logs, workerConnected: true };
  } catch {
    return { logs: [], workerConnected: true };
  }
}

function preferredKeyIdsByDomain(vault: RelaybaseApiKeyRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of vault) {
    const domain = entry.domain.trim().toLowerCase();
    if (!map.has(domain) && entry.key) {
      map.set(domain, entry.id);
    }
  }
  return map;
}

export async function listUserApiKeys(params: {
  domains: string[];
  domain?: string | null;
  range?: StatsRange;
}): Promise<{ keys: UserApiKeyRow[]; workerConnected: boolean }> {
  const range = params.range ?? "7d";
  const allowed = domainSet(params.domains);
  const scopeDomain = params.domain?.trim().toLowerCase() || null;
  if (scopeDomain && !allowed.has(scopeDomain)) {
    return { keys: [], workerConnected: Boolean(await readRelaybaseWorkerConfig()) };
  }

  const cfg = await readRelaybaseWorkerConfig();
  const workerConnected = Boolean(cfg);
  const [allKeys, vault, logResult] = await Promise.all([
    loadWorkerKeys(),
    readRelaybaseApiKeyVault(),
    loadWorkerLogs(scopeDomain),
  ]);

  const vaultById = new Map(vault.map((entry) => [entry.id, entry]));
  const preferred = preferredKeyIdsByDomain(vault);

  const keys = allKeys
    .filter((key) => keyBelongsToUser(key, allowed))
    .filter((key) => !scopeDomain || key.domain.trim().toLowerCase() === scopeDomain)
    .map((key) => {
      const domain = key.domain.trim().toLowerCase();
      const stored = vaultById.get(key.id);
      return {
        id: key.id,
        domain: key.domain,
        label: key.label,
        keyPrefix: key.keyPrefix,
        apiKey: stored?.key ?? null,
        active: preferred.get(domain) === key.id || (!preferred.has(domain) && key.active),
        createdAt: key.createdAt,
        requests: 0,
        errors: 0,
        emails: 0,
        requestSeries: createEmptyBuckets(range),
      } satisfies UserApiKeyRow;
    });

  const keyIds = new Set(keys.map((key) => key.id));
  const now = Date.now();
  const since = now - rangeMs(range);

  for (const log of logResult.logs) {
    if (!log.keyId || !keyIds.has(log.keyId)) continue;
    const ts = new Date(log.at).getTime();
    if (ts < since) continue;
    const row = keys.find((key) => key.id === log.keyId);
    if (!row) continue;
    row.requests += 1;
    if (!log.ok) row.errors += 1;
    if (log.ok) row.emails += 1;
    const index = bucketIndexFor(ts, range, now);
    if (index !== null) row.requestSeries[index].value += 1;
  }

  return {
    keys,
    workerConnected: workerConnected || logResult.workerConnected,
  };
}

export async function createUserApiKey(params: {
  domains: string[];
  domain: string;
  label?: string;
}): Promise<{
  id: string;
  apiKey: string;
  domain: string;
  label: string | null;
  createdAt: string;
  message: string;
}> {
  const domain = params.domain.trim().toLowerCase();
  if (!domainSet(params.domains).has(domain)) {
    throw new Error("Domain not found for this account");
  }

  const cfg = await readRelaybaseWorkerConfig();
  if (!cfg) {
    throw new Error("Relaybase worker is not configured");
  }

  const result = await createWorkerApiKey(cfg, {
    domain,
    label: params.label,
  });

  await upsertRelaybaseApiKeyRecord({
    id: result.id,
    domain: result.domain,
    label: result.label,
    keyPrefix: result.apiKey.replace(/^fes_/, "").slice(0, 8),
    key: result.apiKey,
    createdAt: result.createdAt,
  });

  return {
    ...result,
    message: `Issued API key for ${result.domain}${result.label ? ` (${result.label})` : ""}`,
  };
}

export async function deleteUserApiKey(params: {
  domains: string[];
  id: string;
}): Promise<void> {
  const cfg = await readRelaybaseWorkerConfig();
  if (!cfg) {
    throw new Error("Relaybase worker is not configured");
  }

  const keys = await listWorkerApiKeys(cfg);
  const key = keys.find((entry) => entry.id === params.id);
  if (!key || !keyBelongsToUser(key, domainSet(params.domains))) {
    throw new Error("Key not found");
  }

  try {
    await deleteWorkerApiKey(cfg, params.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("(404)") && !message.includes("not found")) {
      throw error;
    }
  }
  await removeRelaybaseApiKeyRecord(params.id);
}

export async function activateUserApiKey(params: {
  domains: string[];
  id: string;
}): Promise<{ message: string }> {
  const { keys } = await listUserApiKeys({ domains: params.domains });
  const key = keys.find((entry) => entry.id === params.id);
  if (!key) throw new Error("Key not found");
  if (!key.apiKey) {
    throw new Error("Key secret is not stored locally — re-issue to activate");
  }
  const ok = await preferRelaybaseApiKeyRecord(params.id);
  if (!ok) throw new Error("Key not found in vault");
  return { message: `Using key for ${key.domain}` };
}

export async function collectUserApiStats(params: {
  domains: string[];
  domain?: string | null;
  range: StatsRange;
}): Promise<UserApiStats> {
  const allowed = domainSet(params.domains);
  const scopeDomain = params.domain?.trim().toLowerCase() || null;
  const scopedDomains = scopeDomain
    ? new Set(allowed.has(scopeDomain) ? [scopeDomain] : [])
    : allowed;

  const { keys, workerConnected } = await listUserApiKeys({
    domains: params.domains,
    domain: scopeDomain,
    range: params.range,
  });
  const keyIds = new Set(keys.map((key) => key.id));
  const { logs } = await loadWorkerLogs(scopeDomain);

  const now = Date.now();
  const since = now - rangeMs(params.range);
  const requestBuckets = createEmptyBuckets(params.range);
  const errorBuckets = createEmptyBuckets(params.range);
  const emailBuckets = createEmptyBuckets(params.range);
  const apiKeyBuckets = createEmptyBuckets(params.range);
  const keysUsedInRange = new Set<string>();
  const keysByBucket = new Map<number, Set<string>>();

  for (const log of logs) {
    if (!logBelongsToUser(log, keyIds, scopedDomains)) continue;
    const ts = new Date(log.at).getTime();
    if (ts < since) continue;
    const index = bucketIndexFor(ts, params.range, now);
    if (index === null) continue;
    requestBuckets[index].value += 1;
    if (!log.ok) errorBuckets[index].value += 1;
    if (log.ok) emailBuckets[index].value += 1;
    if (log.keyId && keyIds.has(log.keyId)) {
      keysUsedInRange.add(log.keyId);
      const set = keysByBucket.get(index) ?? new Set<string>();
      set.add(log.keyId);
      keysByBucket.set(index, set);
    }
  }

  for (const [index, used] of keysByBucket) {
    apiKeyBuckets[index].value = used.size;
  }

  return {
    range: params.range,
    workerConnected,
    totals: {
      apiKeys: keys.length,
      apiKeysUsed: keysUsedInRange.size,
      requests: requestBuckets.reduce((sum, b) => sum + b.value, 0),
      errors: errorBuckets.reduce((sum, b) => sum + b.value, 0),
      emails: emailBuckets.reduce((sum, b) => sum + b.value, 0),
    },
    series: {
      apiKeysUsed: apiKeyBuckets,
      requests: requestBuckets,
      errors: errorBuckets,
      emails: emailBuckets,
    },
  };
}
