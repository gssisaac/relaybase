import type { DesktopCredentials } from "@/lib/desktop/bridge";
import { desktopVerifyWorkerConnection } from "@/lib/desktop/bridge";

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
    return {
      cfConnected,
      worker: workerStatusFromConnect(result),
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

  return { cf, worker, r2 };
}
