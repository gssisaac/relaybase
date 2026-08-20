import type { DesktopCredentials } from "@/lib/desktop/bridge";
import { desktopVerifyWorkerConnection } from "@/lib/desktop/bridge";
import {
  D1_APP_DEFAULT,
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
  /** True when the Worker reports a CF_API_TOKEN wrangler secret is set
   * (the live probe is the source of truth). Falls back to the local
   * serverToken + pushedAt signal only when the probe can't run. This is what
   * the dashboard "Cloudflare" card reflects. */
  cfConnected: boolean;
  /** True when an install token (Workers Scripts Edit) is saved locally.
   * Used only inside Settings; not shown on the dashboard card. */
  cfInstallTokenPresent: boolean;
  worker: {
    ok: boolean;
    workerUrl: string;
    workerScriptName: string;
    /** CF account id reported by the Worker (from CF_ACCOUNT_ID secret). */
    accountId: string;
    r2Configured: boolean;
    inboundBucketName: string;
    r2TotalBytes?: number | null;
    r2ObjectCount?: number | null;
    r2UsageTruncated?: boolean | null;
    /** True when the Worker reports a CF_API_TOKEN wrangler secret is set. */
    cfApiTokenSet: boolean;
    d1Logs: D1BindingSnapshot;
    d1InboxIndex: D1BindingSnapshot;
    d1App: D1BindingSnapshot;
  } | null;
};

/**
 * Server token is "configured" for dashboard purposes when it is saved
 * locally AND has been pushed to the Worker at least once (pushedAt set).
 * The install token alone must not make this true — that was the bug where
 * the dashboard showed "Connected" but sending failed with [10000].
 */
export function cfServerTokenConfigured(
  credentials: DesktopCredentials | null | undefined,
): boolean {
  return Boolean(
    credentials?.serverToken?.trim() &&
      credentials?.serverTokenPushedAt?.trim(),
  );
}

/** Install token present (Workers Scripts Edit). Settings-only signal. */
export function cfInstallTokenPresent(
  credentials: DesktopCredentials | null | undefined,
): boolean {
  return Boolean(credentials?.installToken?.trim());
}

/**
 * @deprecated Use {@link cfServerTokenConfigured}. Kept temporarily for
 * callers being migrated; returns the server-token-configured state so old
 * "cfConnected" semantics now mean "ready to send".
 */
export function cfConnectedFromCredentials(
  credentials: DesktopCredentials | null | undefined,
): boolean {
  return cfServerTokenConfigured(credentials);
}

export function workerStatusFromConnect(
  result: Awaited<ReturnType<typeof desktopVerifyWorkerConnection>>,
): NonNullable<ConnectionStatusSnapshot["worker"]> {
  return {
    ok: result.ok,
    workerUrl: result.workerUrl,
    workerScriptName: result.workerScriptName,
    accountId: result.accountId?.trim() ?? "",
    r2Configured: result.r2Configured,
    inboundBucketName: result.inboundBucketName || "relaybase-mailbox",
    r2TotalBytes: result.r2TotalBytes ?? null,
    r2ObjectCount: result.r2ObjectCount ?? null,
    r2UsageTruncated: result.r2UsageTruncated ?? null,
    cfApiTokenSet: Boolean(result.cfApiTokenSet),
    d1Logs: result.d1Logs,
    d1InboxIndex: result.d1InboxIndex,
    d1App: result.d1App,
  };
}

export async function probeConnectionStatus(
  credentials: DesktopCredentials | null | undefined,
): Promise<ConnectionStatusSnapshot> {
  const localCfConnected = cfServerTokenConfigured(credentials);
  const cfInstallTokenPresentVal = cfInstallTokenPresent(credentials);
  const url = credentials?.workerUrl?.trim();
  const token = credentials?.adminToken?.trim();

  if (!url || !token) {
    return { cfConnected: localCfConnected, cfInstallTokenPresent: cfInstallTokenPresentVal, worker: null };
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
    // The Worker's CF_API_TOKEN secret is the source of truth for whether
    // sending is configured. Device-local storage is not a management
    // signal — only a convenience for re-pushing. When the probe succeeds,
    // use it; fall back to the local signal only when the probe can't run.
    const cfConnected = worker.ok ? worker.cfApiTokenSet : localCfConnected;
    return {
      cfConnected,
      cfInstallTokenPresent: cfInstallTokenPresentVal,
      worker,
    };
  } catch {
    return {
      cfConnected: localCfConnected,
      cfInstallTokenPresent: cfInstallTokenPresentVal,
      worker: {
        ok: false,
        workerUrl: url,
        workerScriptName: credentials?.workerScriptName || "relaybase-api",
        accountId: credentials?.accountId?.trim() ?? "",
        r2Configured: false,
        inboundBucketName: "relaybase-mailbox",
        r2TotalBytes: null,
        r2ObjectCount: null,
        r2UsageTruncated: null,
        cfApiTokenSet: false,
        d1Logs: { ...D1_LOGS_DEFAULT },
        d1InboxIndex: { ...D1_INBOX_INDEX_DEFAULT },
        d1App: { ...D1_APP_DEFAULT },
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
        label: "Configured",
        detail:
          "Email Sending Edit token pushed to the Worker as the CF_API_TOKEN secret. Sending is enabled.",
      }
    : {
        tone: "bad",
        label: "Not configured",
        detail:
          "Add an Email Sending Edit token in Settings and push it to the Worker to enable sending.",
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

  const logsOk = snapshot?.worker?.d1Logs?.configured === true;
  const searchOk = snapshot?.worker?.d1InboxIndex?.configured === true;
  const appOk = snapshot?.worker?.d1App?.configured === true;
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
      : logsOk && searchOk && appOk
        ? {
            tone: "ok",
            label: "Configured",
            detail: "Logs, inbox search, and product DB bindings work.",
          }
        : logsOk && searchOk
          ? {
              tone: "ok",
              label: "Logs + search configured",
              detail: "Product DB (relaybase-db) is not bound.",
            }
          : logsOk
            ? {
                tone: "ok",
                label: "Logs configured",
                detail: "Ops log is ready. Inbox search / product DB not bound.",
              }
            : searchOk
              ? {
                  tone: "ok",
                  label: "Search configured",
                  detail: "Inbox search is ready. Ops log / product DB not bound.",
                }
              : appOk
                ? {
                    tone: "ok",
                    label: "Product DB configured",
                    detail: "relaybase-db is ready. Logs / inbox search not bound.",
                  }
                : {
                    tone: "bad",
                    label: "Not configured",
                    detail: "Bind RELAYBASE_LOGS / RELAYBASE_DB in wrangler.toml.",
                  };

  return { cf, worker, r2, d1 };
}
