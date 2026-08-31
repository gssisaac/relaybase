import type { DesktopCredentials } from "@/lib/desktop/bridge";
import {
  desktopOwnerSessionStatus,
  desktopVerifyWorkerConnection,
  isDesktopRuntime,
  mailApiReady,
} from "@/lib/desktop/bridge";
import { ensureAccessToken } from "@/lib/desktop/auth";
import {
  D1_APP_DEFAULT,
  D1_MAIL_DEFAULT,
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
  /** True when the Worker reports a working CF_API_TOKEN + CF_ACCOUNT_ID
   * (`cfApiTokenSet` + `cfApiTokenValid` + accountId). Domain / routing API, not send. */
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
    /** True when that secret passed a Cloudflare Zone Read probe. */
    cfApiTokenValid?: boolean;
    /** True when the Worker has a send_email EMAIL binding. */
    emailBindingConfigured: boolean;
    d1Logs: D1BindingSnapshot;
    d1Mail: D1BindingSnapshot;
    /** @deprecated Renamed to d1Mail. Kept for callers being migrated. */
    d1InboxIndex: D1BindingSnapshot;
    d1App: D1BindingSnapshot;
  } | null;
};

/** Install token present (Workers Scripts Edit). Settings-only signal. */
export function cfInstallTokenPresent(
  credentials: DesktopCredentials | null | undefined,
): boolean {
  return Boolean(credentials?.cfOauthAccessToken?.trim());
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
    cfApiTokenValid: result.cfApiTokenValid,
    emailBindingConfigured: Boolean(result.emailBindingConfigured),
    d1Logs: result.d1Logs,
    d1Mail: result.d1Mail,
    d1InboxIndex: result.d1Mail,
    d1App: result.d1App,
  };
}

export async function probeConnectionStatus(
  credentials: DesktopCredentials | null | undefined,
  options?: { hasConsoleAccess?: boolean },
): Promise<ConnectionStatusSnapshot> {
  const cfInstallTokenPresentVal = cfInstallTokenPresent(credentials);
  let url = credentials?.workerUrl?.trim() ?? "";

  if (isDesktopRuntime()) {
    const owner = await desktopOwnerSessionStatus();
    if (!url) url = owner.workerUrl?.trim() ?? "";
    if (!url) {
      return {
        cfConnected: false,
        cfInstallTokenPresent: cfInstallTokenPresentVal,
        worker: null,
      };
    }
    const hasConsole = options?.hasConsoleAccess ?? owner.hasConsoleAccess;
    if (!hasConsole) {
      return {
        cfConnected: false,
        cfInstallTokenPresent: cfInstallTokenPresentVal,
        worker: null,
      };
    }
    try {
      const result = await desktopVerifyWorkerConnection(url);
      const worker = workerStatusFromConnect(result);
      // D1 fallback probes need a Bearer token; Rust verify_worker_connection
      // already probes D1 when /console/connect omits bindings.
      const cfConnected = worker.ok ? mailApiReady(worker) : false;
      return {
        cfConnected,
        cfInstallTokenPresent: cfInstallTokenPresentVal,
        worker,
      };
    } catch {
      return {
        cfConnected: false,
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
          cfApiTokenValid: undefined,
          emailBindingConfigured: false,
          d1Logs: { ...D1_LOGS_DEFAULT },
          d1Mail: { ...D1_MAIL_DEFAULT },
          d1InboxIndex: { ...D1_MAIL_DEFAULT },
          d1App: { ...D1_APP_DEFAULT },
        },
      };
    }
  }

  const access = await ensureAccessToken();

  if (!url) {
    return { cfConnected: false, cfInstallTokenPresent: cfInstallTokenPresentVal, worker: null };
  }

  try {
    if (!access) {
      return { cfConnected: false, cfInstallTokenPresent: cfInstallTokenPresentVal, worker: null };
    }
    const result = await desktopVerifyWorkerConnection(url);
    const worker = workerStatusFromConnect(result);
    if (
      worker.ok &&
      !worker.d1Logs.configured &&
      !worker.d1Mail.configured
    ) {
      const fallback = await probeD1WhenConnectOmits(url.replace(/\/$/, ""), access);
      if (fallback.d1Logs.configured || fallback.d1Mail.configured) {
        worker.d1Logs = fallback.d1Logs;
        worker.d1Mail = fallback.d1Mail;
        worker.d1InboxIndex = fallback.d1Mail;
      }
    }
    const cfConnected = worker.ok ? mailApiReady(worker) : false;
    return {
      cfConnected,
      cfInstallTokenPresent: cfInstallTokenPresentVal,
      worker,
    };
  } catch {
    return {
      cfConnected: false,
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
        cfApiTokenValid: undefined,
        emailBindingConfigured: false,
        d1Logs: { ...D1_LOGS_DEFAULT },
        d1Mail: { ...D1_MAIL_DEFAULT },
        d1InboxIndex: { ...D1_MAIL_DEFAULT },
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
          "CF_API_TOKEN is set on the Worker and Cloudflare accepted it. Domain, address, and DNS API calls can run. Sending uses the EMAIL binding.",
      }
    : {
        tone: "bad",
        label: "Not configured",
        detail:
          "Add a CF_API_TOKEN secret on the Worker in Cloudflare so Relaybase can manage domains and inbox routing.",
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
            detail: "Worker reachable and owner session accepted.",
          }
        : {
            tone: "bad",
            label: "Unreachable",
            detail: "Check Worker URL, console unlock, and deploy.",
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
  const searchOk = snapshot?.worker?.d1Mail?.configured === true;
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
