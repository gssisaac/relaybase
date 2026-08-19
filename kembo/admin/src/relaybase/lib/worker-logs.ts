import { resolveEmailSenderConfig } from "@/relaybase/lib/config";
import type {
  EmailSenderLogEntry,
  EmailSenderLogSummary,
} from "@/relaybase/components/types";

const MAX_LOGS = 500;

export type EmailSenderLogsResult = {
  logs: EmailSenderLogEntry[];
  summary: EmailSenderLogSummary;
};

/**
 * Read the worker's send log via its `/console/send-logs` HTTP endpoint
 * (admin-token auth). Replaces the former direct Cloudflare KV read.
 */
export async function listWorkerSendLogs(params?: {
  limit?: number;
  status?: "all" | "failed" | "success";
  domain?: string;
}): Promise<EmailSenderLogsResult> {
  const limit = Math.min(Math.max(params?.limit ?? 100, 1), MAX_LOGS);
  const status = params?.status ?? "all";
  const domain = params?.domain?.trim() || undefined;

  const cfg = await resolveEmailSenderConfig();
  if (!cfg) {
    return { logs: [], summary: { total: 0, failed: 0, failedLast24h: 0 } };
  }

  const search = new URLSearchParams({ limit: String(limit), status });
  if (domain) search.set("domain", domain);

  const url = `${cfg.baseUrl.replace(/\/$/, "")}/console/send-logs?${search.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.adminToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as
    | (EmailSenderLogsResult & { error?: string })
    | { error?: string };

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ??
        `Worker send-logs request failed (${res.status})`,
    );
  }

  const result = data as EmailSenderLogsResult;
  return {
    logs: result.logs ?? [],
    summary: result.summary ?? { total: 0, failed: 0, failedLast24h: 0 },
  };
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
