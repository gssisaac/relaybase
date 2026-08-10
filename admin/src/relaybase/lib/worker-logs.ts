import { CloudflareClient } from "@/lib/cloudflare/client";
import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import { readEmailSenderSettings } from "@/relaybase/lib/settings";
import type {
  EmailSenderLogEntry,
  EmailSenderLogSummary,
} from "@/relaybase/components/types";
import { resolveWorkerScriptName, DEFAULT_KV_NAMESPACE_TITLE } from "./worker-config";

const SENDLOG_PREFIX = "srv:sendlog:";
const SENDLOG_INDEX_KEY = "srv:sendlog:_index";
const MAX_LOGS = 500;

export type EmailSenderLogsResult = {
  logs: EmailSenderLogEntry[];
  summary: EmailSenderLogSummary;
};

async function createClient(): Promise<CloudflareClient> {
  const settings = await readEmailSenderSettings();
  const env = readRelaybaseEnvSettings();
  const accountId = env.cloudflareAccountId || settings.cloudflareAccountId;
  const apiToken = env.cloudflareApiToken || settings.cloudflareApiToken;
  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare account ID and API token are required in Relaybase settings.",
    );
  }
  return CloudflareClient.create({ accountId, apiToken });
}

async function resolveKvNamespaceId(
  client: CloudflareClient,
): Promise<string> {
  const scriptName = await resolveWorkerScriptName();
  const namespaceId = await client.resolveWorkerKvNamespaceId(
    scriptName,
    "RELAYBASE_APP",
    DEFAULT_KV_NAMESPACE_TITLE,
  );
  if (!namespaceId) {
    throw new Error(
      `Could not resolve the RELAYBASE_APP KV namespace for worker "${scriptName}".`,
    );
  }
  return namespaceId;
}

function matchesFilters(
  log: EmailSenderLogEntry,
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

function summarize(logs: EmailSenderLogEntry[]): EmailSenderLogSummary {
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

/**
 * Read the worker's send log directly from its RELAYBASE_APP KV namespace.
 * Replaces the former worker GET /admin/logs proxy.
 */
export async function listWorkerSendLogs(params?: {
  limit?: number;
  status?: "all" | "failed" | "success";
  domain?: string;
}): Promise<EmailSenderLogsResult> {
  const limit = Math.min(Math.max(params?.limit ?? 100, 1), MAX_LOGS);
  const status = params?.status ?? "all";
  const domain = params?.domain?.trim() || undefined;

  const client = await createClient();
  const namespaceId = await resolveKvNamespaceId(client);

  const rawIndex = await client.getKvValue(namespaceId, SENDLOG_INDEX_KEY);
  const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];

  const logs: EmailSenderLogEntry[] = [];
  for (const id of index) {
    if (logs.length >= limit) break;
    const raw = await client.getKvValue(namespaceId, `${SENDLOG_PREFIX}${id}`);
    if (!raw) continue;
    const log = JSON.parse(raw) as EmailSenderLogEntry;
    if (!matchesFilters(log, { status, domain })) continue;
    logs.push(log);
  }

  const allForSummary: EmailSenderLogEntry[] = [];
  for (const id of index) {
    const raw = await client.getKvValue(namespaceId, `${SENDLOG_PREFIX}${id}`);
    if (!raw) continue;
    allForSummary.push(JSON.parse(raw) as EmailSenderLogEntry);
  }

  return { logs, summary: summarize(allForSummary) };
}

/** Convenience: return only the log entries (used by stats/user-profile). */
export async function listWorkerSendLogEntries(
  params?: {
    limit?: number;
    status?: "all" | "failed" | "success";
    domain?: string;
  },
): Promise<EmailSenderLogEntry[]> {
  return (await listWorkerSendLogs(params)).logs;
}
