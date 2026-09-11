import type { DesktopCredentials } from "@/lib/desktop/bridge";
import {
  desktopOwnerSessionStatus,
  desktopVerifyWorkerConnection,
  isDesktopRuntime,
  mailApiReady,
  type CfApiTokenPermissions,
} from "@/lib/desktop/bridge";
import { ensureAccessToken } from "@/lib/desktop/auth";
import {
  D1_APP_DEFAULT,
  D1_MAIL_DEFAULT,
  D1_LOGS_DEFAULT,
  type D1BindingSnapshot,
} from "@/lib/dashboard/d1-binding-status";
import { probeD1WhenConnectOmits } from "@/lib/dashboard/d1-fallback-probe";

export type {
  HealthStatus,
  HealthTone,
} from "@/lib/dashboard/connection-health";
export {
  checkingHealth,
  connectionHealthFromSnapshot,
} from "@/lib/dashboard/connection-health";

export type ConnectionStatusSnapshot = {
  /** True when the Worker reports a working CF_API_TOKEN
   * (`cfApiTokenSet` + `cfApiTokenValid`). Domain / routing API, not send. */
  cfConnected: boolean;
  /** True when an install token (Workers Scripts Edit) is saved locally.
   * Used only inside Settings; not shown on the dashboard card. */
  cfInstallTokenPresent: boolean;
  worker: {
    ok: boolean;
    workerUrl: string;
    workerScriptName: string;
    /** CF account id from the Worker (env or D1). Optional — UI falls back to credentials. */
    accountId: string;
    r2Configured: boolean;
    inboundBucketName: string;
    r2TotalBytes?: number | null;
    r2ObjectCount?: number | null;
    r2UsageTruncated?: boolean | null;
    /** True when the Worker reports a CF_API_TOKEN wrangler secret is set. */
    cfApiTokenSet: boolean;
    /** True when that secret passed Zone Read + routing/DNS Edit probes. */
    cfApiTokenValid?: boolean;
    /** Per-row Cloudflare token probe from `/console/connect`. */
    cfApiTokenPermissions?: CfApiTokenPermissions;
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
  return Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );
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
    cfApiTokenPermissions: result.cfApiTokenPermissions,
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
          cfApiTokenPermissions: undefined,
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
        cfApiTokenPermissions: undefined,
        emailBindingConfigured: false,
        d1Logs: { ...D1_LOGS_DEFAULT },
        d1Mail: { ...D1_MAIL_DEFAULT },
        d1InboxIndex: { ...D1_MAIL_DEFAULT },
        d1App: { ...D1_APP_DEFAULT },
      },
    };
  }
}
