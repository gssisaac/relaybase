export type SendLogEntry = {
  id: string;
  at: string;
  ok: boolean;
  status: number;
  domain: string | null;
  keyId: string | null;
  keyPrefix: string | null;
  keyLabel: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  messageId?: string;
  error?: string;
};

export type SendLogSummary = {
  total: number;
  failed: number;
  failedLast24h: number;
};

const MAX_LOGS = 500;
const INDEX_KEY = "sent/_sendlog/_index.json";

function logKey(id: string): string {
  return `sent/_sendlog/${id}.json`;
}

const JSON_META = { httpMetadata: { contentType: "application/json" } };

async function readJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as T;
  } catch {
    return null;
  }
}

export async function recordSendLog(
  bucket: R2Bucket,
  entry: Omit<SendLogEntry, "id" | "at"> & { id?: string; at?: string },
): Promise<SendLogEntry> {
  const id = entry.id ?? crypto.randomUUID();
  const at = entry.at ?? new Date().toISOString();
  const record: SendLogEntry = { ...entry, id, at };

  await bucket.put(logKey(id), JSON.stringify(record), JSON_META);

  const index = (await readJson<string[]>(bucket, INDEX_KEY)) ?? [];
  const next = [id, ...index.filter((item) => item !== id)].slice(0, MAX_LOGS);
  await bucket.put(INDEX_KEY, JSON.stringify(next), JSON_META);

  for (const staleId of index.slice(MAX_LOGS - 1)) {
    if (!next.includes(staleId)) {
      await bucket.delete(logKey(staleId));
    }
  }

  return record;
}

function matchesFilters(
  log: SendLogEntry,
  filters: { status?: "all" | "failed" | "success"; domain?: string },
): boolean {
  if (filters.status === "failed" && log.ok) return false;
  if (filters.status === "success" && !log.ok) return false;
  if (filters.domain) {
    const needle = filters.domain.trim().toLowerCase();
    if (!needle) return true;
    if (!log.domain?.toLowerCase().includes(needle)) return false;
  }
  return true;
}

function summarize(logs: SendLogEntry[]): SendLogSummary {
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

export async function listSendLogs(
  bucket: R2Bucket,
  filters: {
    limit?: number;
    status?: "all" | "failed" | "success";
    domain?: string;
  } = {},
): Promise<{ logs: SendLogEntry[]; summary: SendLogSummary }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), MAX_LOGS);
  const index = (await readJson<string[]>(bucket, INDEX_KEY)) ?? [];

  const logs: SendLogEntry[] = [];
  for (const id of index) {
    if (logs.length >= limit) break;
    const log = await readJson<SendLogEntry>(bucket, logKey(id));
    if (!log) continue;
    if (!matchesFilters(log, filters)) continue;
    logs.push(log);
  }

  const allForSummary: SendLogEntry[] = [];
  for (const id of index) {
    const log = await readJson<SendLogEntry>(bucket, logKey(id));
    if (!log) continue;
    allForSummary.push(log);
  }

  return { logs, summary: summarize(allForSummary) };
}
