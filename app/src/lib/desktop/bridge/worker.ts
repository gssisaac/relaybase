import {
  d1BindingFromPayload,
  type D1BindingSnapshot,
} from "@/lib/dashboard/d1-binding-status";
import { probeD1WhenConnectOmits } from "@/lib/dashboard/d1-fallback-probe";

import type { DesktopCredentials } from "./credentials";
import {
  desktopGetCredentials,
} from "./credentials";
import { loadLocalCredentialsFile } from "./credentials-local";
import { invoke, isDesktopRuntime } from "./invoke";

export type ZoneSummary = {
  id: string;
  name: string;
  status: string;
};

export type WorkerConnectResult = {
  ok: boolean;
  product: string;
  version: string;
  workerScriptName: string;
  workerUrl: string;
  /** CF account id from the Worker (env or D1). Optional. */
  accountId: string;
  r2Configured: boolean;
  inboundBucketName: string;
  /** Sum of inbound R2 object sizes in bytes, when the Worker reported usage. */
  r2TotalBytes?: number | null;
  r2ObjectCount?: number | null;
  /** True when the Worker stopped scanning early (large bucket). */
  r2UsageTruncated?: boolean | null;
  /** True when the Worker has a CF_API_TOKEN wrangler secret set. */
  cfApiTokenSet?: boolean;
  /** True when that secret passed a Cloudflare Zone Read probe. */
  cfApiTokenValid?: boolean;
  /** True when the Worker has a send_email EMAIL binding. */
  emailBindingConfigured?: boolean;
  d1Logs: D1BindingSnapshot;
  d1Mail: D1BindingSnapshot;
  /** @deprecated Renamed to d1Mail. Kept for callers being migrated. */
  d1InboxIndex: D1BindingSnapshot;
  d1App: D1BindingSnapshot;
};

export async function desktopVerifyCfToken(
  accountId: string,
  apiToken: string,
  scope: "install" | "server",
): Promise<{ ok: boolean; accountId: string; message: string }> {
  return invoke("verify_cf_token", { accountId, apiToken, scope });
}

/** Push a one-shot server token to the Worker as `CF_API_TOKEN`. Not persisted. */
export async function desktopPushServerToken(serverToken: string): Promise<{
  ok: boolean;
  message: string;
  pushedAt: string;
}> {
  return invoke("push_server_token", { serverToken: serverToken.trim() });
}

const CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.relaybase.xyz";

/**
 * Register the customer Worker URL with the Relaybase console so the account
 * ↔ Worker mapping is known for recovery. Requires a Relaybase account
 * session (relaybaseSession in credentials). No-op if not signed in.
 */
export async function desktopRegisterWorkerWithConsole(
  workerUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = isDesktopRuntime()
    ? await desktopGetCredentials()
    : await loadLocalCredentialsFile();
  const session = existing?.relaybaseSession?.trim() ?? "";
  if (!session) {
    return { ok: false, error: "Not signed in to Relaybase" };
  }
  const res = await fetch(
    `${CONSOLE_URL.replace(/\/$/, "")}/api/v1/account?action=worker/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
      },
      body: JSON.stringify({ workerUrl }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function desktopVerifyWorkerConnection(
  workerUrl: string,
): Promise<WorkerConnectResult> {
  if (isDesktopRuntime()) {
    return invoke("verify_worker_connection", {
      workerUrl,
    });
  }

  const { ensureAccessToken } = await import("@/lib/desktop/auth");
  const access = await ensureAccessToken();
  const base = workerUrl.replace(/\/$/, "");
  if (!access) {
    throw new Error("Owner session required. Sign in with your passtoken.");
  }
  const connect = await fetch(`${base}/console/connect`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!connect.ok) {
    throw new Error(
      connect.status === 401 || connect.status === 403
        ? "Owner session rejected by Worker"
        : `Worker connect failed (${connect.status})`,
    );
  }
  const value = (await connect.json().catch(() => ({}))) as {
    version?: string;
    workerScriptName?: string;
    accountId?: string;
    inbound?: {
      r2Configured?: boolean;
      bucketName?: string;
      usage?: {
        totalBytes?: number;
        objectCount?: number;
        truncated?: boolean;
      };
    };
    d1?: Parameters<typeof d1BindingFromPayload>[0];
    cfApiTokenSet?: boolean;
    cfApiTokenValid?: boolean;
    emailBindingConfigured?: boolean;
  };
  const usage = value.inbound?.usage;
  let d1Logs = d1BindingFromPayload(value.d1, "logs");
  let d1Mail = d1BindingFromPayload(value.d1, "mail");
  const d1App = d1BindingFromPayload(value.d1, "app");

  if (
    !value.d1 ||
    (!d1Logs.configured &&
      !d1Mail.configured &&
      !value.d1.logs &&
      !value.d1.mail &&
      !value.d1.inboxIndex)
  ) {
    const fallback = await probeD1WhenConnectOmits(base, access);
    if (fallback.d1Logs.configured || fallback.d1Mail.configured) {
      d1Logs = fallback.d1Logs;
      d1Mail = fallback.d1Mail;
    }
  }

  return {
    ok: true,
    product: "relaybase",
    version: value.version?.trim() || "unknown",
    workerScriptName: value.workerScriptName ?? "relaybase-api",
    workerUrl: base,
    accountId: value.accountId?.trim() ?? "",
    r2Configured: Boolean(value.inbound?.r2Configured),
    inboundBucketName: value.inbound?.bucketName ?? "",
    r2TotalBytes: usage?.totalBytes ?? null,
    r2ObjectCount: usage?.objectCount ?? null,
    r2UsageTruncated: usage?.truncated ?? null,
    cfApiTokenSet: Boolean(value.cfApiTokenSet),
    cfApiTokenValid:
      typeof value.cfApiTokenValid === "boolean"
        ? value.cfApiTokenValid
        : undefined,
    emailBindingConfigured: Boolean(value.emailBindingConfigured),
    d1Logs,
    d1Mail,
    d1InboxIndex: d1Mail,
    d1App,
  };
}

export async function desktopSaveWorkerConnection(input: {
  workerUrl: string;
  workerScriptName?: string;
  workerVersion?: string;
}): Promise<DesktopCredentials> {
  if (isDesktopRuntime()) {
    return invoke("save_worker_connection", {
      workerUrl: input.workerUrl,
      workerScriptName: input.workerScriptName ?? null,
      workerVersion: input.workerVersion?.trim() ? input.workerVersion.trim() : null,
    });
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId: existing?.accountId ?? "",
    installToken: existing?.installToken ?? "",
    workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
    workerScriptName:
      input.workerScriptName?.trim() || existing?.workerScriptName || "",
    workerVersion:
      input.workerVersion?.trim() || existing?.workerVersion || "",
    relaybaseAccountId: existing?.relaybaseAccountId ?? "",
    relaybaseEmail: existing?.relaybaseEmail ?? "",
    relaybaseSession: existing?.relaybaseSession ?? "",
    cfOauthAccessToken: existing?.cfOauthAccessToken ?? "",
    cfOauthRefreshToken: existing?.cfOauthRefreshToken ?? "",
    cfOauthAccessExpiresAt: existing?.cfOauthAccessExpiresAt ?? "",
    cfOauthAccountId: existing?.cfOauthAccountId ?? "",
  };
  const res = await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) {
    throw new Error("Failed to save credentials to ~/.relaybase");
  }
  return next;
}

export async function desktopWorkerRequest(input: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; headers: [string, string][]; bodyBase64: string }> {
  return invoke("worker_request_cmd", { input });
}
