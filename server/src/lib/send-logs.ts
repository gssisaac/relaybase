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
const INDEX_KEY = "sendlog:_index";

function logKey(id: string): string {
  return `sendlog:${id}`;
}

export async function recordSendLog(
  kv: KVNamespace,
  entry: Omit<SendLogEntry, "id" | "at"> & { id?: string; at?: string },
): Promise<SendLogEntry> {
  const id = entry.id ?? crypto.randomUUID();
  const at = entry.at ?? new Date().toISOString();
  const record: SendLogEntry = { ...entry, id, at };

  await kv.put(logKey(id), JSON.stringify(record));

  const rawIndex = await kv.get(INDEX_KEY);
  const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
  const next = [id, ...index.filter((item) => item !== id)].slice(0, MAX_LOGS);
  await kv.put(INDEX_KEY, JSON.stringify(next));

  for (const staleId of index.slice(MAX_LOGS - 1)) {
    if (!next.includes(staleId)) {
      await kv.delete(logKey(staleId));
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
  kv: KVNamespace,
  filters: {
    limit?: number;
    status?: "all" | "failed" | "success";
    domain?: string;
  } = {},
): Promise<{ logs: SendLogEntry[]; summary: SendLogSummary }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), MAX_LOGS);
  const rawIndex = await kv.get(INDEX_KEY);
  const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];

  const logs: SendLogEntry[] = [];
  for (const id of index) {
    if (logs.length >= limit) break;
    const raw = await kv.get(logKey(id));
    if (!raw) continue;
    const log = JSON.parse(raw) as SendLogEntry;
    if (!matchesFilters(log, filters)) continue;
    logs.push(log);
  }

  const allForSummary: SendLogEntry[] = [];
  for (const id of index) {
    const raw = await kv.get(logKey(id));
    if (!raw) continue;
    allForSummary.push(JSON.parse(raw) as SendLogEntry);
  }

  return { logs, summary: summarize(allForSummary) };
}
