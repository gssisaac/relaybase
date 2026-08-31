import type {
  EmailSenderLogEntry,
  EmailSenderLogSummary,
} from "@/relaybase/components/types";

export type EmailSenderLogsResult = {
  logs: EmailSenderLogEntry[];
  summary: EmailSenderLogSummary;
};

/** HQ no longer reads customer Worker send logs. */
export async function listWorkerSendLogs(_params?: {
  limit?: number;
  status?: "all" | "failed" | "success";
  domain?: string;
}): Promise<EmailSenderLogsResult> {
  return { logs: [], summary: { total: 0, failed: 0, failedLast24h: 0 } };
}

export async function listWorkerSendLogEntries(
  params?: {
    limit?: number;
    status?: "all" | "failed" | "success";
    domain?: string;
  },
): Promise<EmailSenderLogEntry[]> {
  return (await listWorkerSendLogs(params)).logs;
}
