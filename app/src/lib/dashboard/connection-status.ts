import type { DesktopCredentials } from "@/lib/desktop/bridge";
import { desktopVerifyWorkerConnection } from "@/lib/desktop/bridge";
import {
  D1_INBOX_INDEX_DEFAULT,
  D1_LOGS_DEFAULT,
  type D1BindingSnapshot,
} from "@/lib/dashboard/d1-binding-status";
import { probeD1WhenConnectOmits } from "@/lib/dashboard/d1-fallback-probe";

export type HealthTone = "ok" | "bad" | "pending" | "neutral";

export type HealthStatus = {
  tone: HealthTone;
  label: string;
  detail: string;
};

export type ConnectionStatusSnapshot = {
  cfConnected: boolean;
  worker: {
    ok: boolean;
    workerUrl: string;
    workerScriptName: string;
    r2Configured: boolean;
    inboundBucketName: string;
    r2TotalBytes?: number | null;
    r2ObjectCount?: number | null;
    r2UsageTruncated?: boolean | null;
    d1Logs: D1BindingSnapshot;
    d1InboxIndex: D1BindingSnapshot;
  } | null;
};

export function cfConnectedFromCredentials(
  credentials: DesktopCredentials | null | undefined,
): boolean {
  return Boolean(
    credentials?.accountId?.trim() && credentials?.apiToken?.trim(),
  );
}

export function workerStatusFromConnect(
  result: Awaited<ReturnType<typeof desktopVerifyWorkerConnection>>,
): NonNullable<ConnectionStatusSnapshot["worker"]> {
  return {
    ok: result.ok,
    workerUrl: result.workerUrl,
    workerScriptName: result.workerScriptName,
    r2Configured: result.r2Configured,
    inboundBucketName: result.inboundBucketName || "relaybase-inbound",
    r2TotalBytes: result.r2TotalBytes ?? null,
    r2ObjectCount: result.r2ObjectCount ?? null,
    r2UsageTruncated: result.r2UsageTruncated ?? null,
    d1Logs: result.d1Logs,
    d1InboxIndex: result.d1InboxIndex,
  };
}

export async function probeConnectionStatus(
  credentials: DesktopCredentials | null | undefined,
): Promise<ConnectionStatusSnapshot> {
  const cfConnected = cfConnectedFromCredentials(credentials);
  const url = credentials?.workerUrl?.trim();
  const token = credentials?.adminToken?.trim();

  if (!url || !token) {
    return { cfConnected, worker: null };
  }

  try {
    const result = await desktopVerifyWorkerConnection(url, token);
    const worker = workerStatusFromConnect(result);
    if (
      worker.ok &&
      !worker.d1Logs.configured &&
      !worker.d1InboxIndex.configured
    ) {
      const fallback = await probeD1WhenConnectOmits(url.replace(/\/$/, ""), token);
      if (fallback.d1Logs.configured || fallback.d1InboxIndex.configured) {
        worker.d1Logs = fallback.d1Logs;
        worker.d1InboxIndex = fallback.d1InboxIndex;
      }
    }
    return {
      cfConnected,
      worker,
    };
  } catch {
    return {
      cfConnected,
      worker: {
        ok: false,
        workerUrl: url,
        workerScriptName: credentials?.workerScriptName || "relaybase-api",
        r2Configured: false,
        inboundBucketName: "relaybase-inbound",
        r2TotalBytes: null,
        r2ObjectCount: null,
        r2UsageTruncated: null,
        d1Logs: { ...D1_LOGS_DEFAULT },
        d1InboxIndex: { ...D1_INBOX_INDEX_DEFAULT },
      },
    };
  }
}

export function connectionHealthFromSnapshot(
  snapshot: ConnectionStatusSnapshot | null,
  options?: { pending?: boolean; hasWorkerCredentials?: boolean },
): {
  cf: HealthStatus;
  worker: HealthStatus;
  r2: HealthStatus;
  d1: HealthStatus;
} {
  const pending = options?.pending ?? false;
  const hasWorker =
    Boolean(snapshot?.worker?.workerUrl?.trim()) ||
    Boolean(options?.hasWorkerCredentials);

  const cf: HealthStatus = snapshot?.cfConnected
    ? {
        tone: "ok",
        label: "Connected",
        detail: "API token saved locally.",
      }
    : {
        tone: "bad",
        label: "Not connected",
        detail: "Add Account ID and API token in Settings.",
      };

  const worker: HealthStatus = !hasWorker
    ? {
        tone: "bad",
        label: "Not connected",
        detail: "No Worker URL saved.",
      }
    : pending && !snapshot?.worker
      ? {
          tone: "pending",
          label: "Checking…",
          detail: "Probing Worker connection.",
        }
      : snapshot?.worker?.ok
        ? {
            tone: "ok",
            label: "Healthy",
            detail: "Worker reachable and admin token accepted.",
          }
        : {
            tone: "bad",
            label: "Unreachable",
            detail: "Check URL, admin token, and deploy.",
          };

  const r2: HealthStatus = !hasWorker
    ? {
        tone: "bad",
        label: "Unavailable",
        detail: "Connect a routing Worker first.",
      }
    : pending && !snapshot?.worker
      ? {
          tone: "pending",
          label: "Checking…",
          detail: "Listing inbound R2 binding.",
        }
      : snapshot?.worker?.r2Configured
        ? {
            tone: "ok",
            label: "Configured",
            detail: "Inbound R2 binding works.",
          }
        : {
            tone: "bad",
            label: "Not configured",
            detail: "Bind INBOUND R2 in wrangler.toml.",
          };

  const logsOk = snapshot?.worker?.d1Logs.configured === true;
  const searchOk = snapshot?.worker?.d1InboxIndex.configured === true;
  const d1: HealthStatus = !hasWorker
    ? {
        tone: "bad",
        label: "Unavailable",
        detail: "Connect a routing Worker first.",
      }
    : pending && !snapshot?.worker
      ? {
          tone: "pending",
          label: "Checking…",
          detail: "Probing D1 bindings.",
        }
      : logsOk && searchOk
        ? {
            tone: "ok",
            label: "Configured",
            detail: "Ops log and inbox search bindings work.",
          }
        : logsOk
          ? {
              tone: "ok",
              label: "Logs configured",
              detail: "Ops log is ready. Inbox search is not bound.",
            }
          : searchOk
            ? {
                tone: "ok",
                label: "Search configured",
                detail: "Inbox search is ready. Ops log is not bound.",
              }
            : {
                tone: "bad",
                label: "Not configured",
                detail: "Bind RELAYBASE_LOGS in wrangler.toml.",
              };

  return { cf, worker, r2, d1 };
}
