import type { EmailSenderConfig } from "./config";
import type {
  EmailSenderLogEntry,
  EmailSenderLogSummary,
} from "@/relaybase/components/types";

export type EmailSenderKey = {
  id: string;
  keyPrefix: string;
  domain: string;
  label: string | null;
  createdAt: string;
  active: boolean;
};

export type CreateEmailSenderKeyResult = {
  id: string;
  apiKey: string;
  domain: string;
  label: string | null;
  createdAt: string;
};

async function emailSenderFetch<T>(
  cfg: EmailSenderConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${cfg.baseUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.adminToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    const hint =
      error instanceof TypeError
        ? ` — cannot reach ${cfg.baseUrl}`
        : "";
    throw new Error(`Relaybase request failed${hint}`);
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Relaybase request failed (${res.status})`);
  }
  return data;
}

export type EmailSenderHealth = {
  ok: boolean;
  inbound?: {
    r2Configured: boolean;
    bucketName: string;
  };
};

export async function fetchEmailSenderHealth(
  baseUrl: string,
): Promise<EmailSenderHealth> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as EmailSenderHealth;
    return {
      ok: data.ok === true,
      inbound: data.inbound,
    };
  } catch {
    return { ok: false };
  }
}

export async function checkEmailSenderHealth(baseUrl: string): Promise<boolean> {
  const health = await fetchEmailSenderHealth(baseUrl);
  return health.ok;
}

export async function listEmailSenderKeys(
  cfg: EmailSenderConfig,
): Promise<EmailSenderKey[]> {
  const data = await emailSenderFetch<{ keys: EmailSenderKey[] }>(
    cfg,
    "/admin/keys",
  );
  return data.keys ?? [];
}

export async function createEmailSenderKey(
  cfg: EmailSenderConfig,
  params: { domain: string; label?: string },
): Promise<CreateEmailSenderKeyResult> {
  return emailSenderFetch<CreateEmailSenderKeyResult>(cfg, "/admin/keys", {
    method: "POST",
    body: JSON.stringify({
      domain: params.domain.trim(),
      label: params.label?.trim() || undefined,
    }),
  });
}

export async function deleteEmailSenderKey(
  cfg: EmailSenderConfig,
  id: string,
): Promise<void> {
  await emailSenderFetch<{ ok: boolean }>(cfg, `/admin/keys/${id}`, {
    method: "DELETE",
  });
}

export type EmailSenderLogsResult = {
  logs: EmailSenderLogEntry[];
  summary: EmailSenderLogSummary;
};

export async function listEmailSenderLogs(
  cfg: EmailSenderConfig,
  params?: {
    limit?: number;
    status?: "all" | "failed" | "success";
    domain?: string;
  },
): Promise<EmailSenderLogsResult> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.status) search.set("status", params.status);
  if (params?.domain?.trim()) search.set("domain", params.domain.trim());
  const qs = search.toString();
  return emailSenderFetch<EmailSenderLogsResult>(
    cfg,
    `/admin/logs${qs ? `?${qs}` : ""}`,
  );
}

export async function sendEmailWithApiKey(
  baseUrl: string,
  apiKey: string,
  params: {
    from: string;
    fromName?: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  },
): Promise<{ messageId: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/send`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      cache: "no-store",
    });
  } catch (error) {
    const hint =
      error instanceof TypeError ? ` — cannot reach ${baseUrl}` : "";
    throw new Error(`Relaybase send failed${hint}`);
  }

  const data = (await res.json().catch(() => ({}))) as {
    messageId?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Relaybase send failed (${res.status})`);
  }
  return { messageId: data.messageId ?? "sent" };
}

async function workerFetch<T>(
  baseUrl: string,
  path: string,
  adminToken: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export async function verifyRelaybaseWorkerAdminToken(
  baseUrl: string,
  adminToken: string,
): Promise<boolean> {
  const trimmed = adminToken.trim();
  if (!trimmed || !baseUrl.trim()) return false;
  const result = await workerFetch<{ keys?: unknown[] }>(
    baseUrl,
    "/admin/keys",
    trimmed,
  );
  return result.ok;
}

export async function syncWorkerRuntimeConfig(params: {
  baseUrl: string;
  adminToken: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  bootstrapToken?: string;
}): Promise<void> {
  const payload = {
    accountId: params.cloudflareAccountId,
    apiToken: params.cloudflareApiToken,
    adminToken: params.adminToken,
  };

  const primary = await workerFetch<{ configured?: boolean }>(
    params.baseUrl,
    "/admin/cloudflare",
    params.adminToken,
    { method: "PUT", body: JSON.stringify(payload) },
  );
  if (primary.ok) return;

  const bootstrapToken = params.bootstrapToken?.trim();
  if (!bootstrapToken) {
    throw new Error(
      formatWorkerSyncFailure({
        step: "admin/cloudflare",
        status: primary.status,
        workerError: primary.data.error,
        adminTokenRejected: primary.status === 401,
        bootstrapAttempted: false,
      }),
    );
  }

  const bootstrap = await workerFetch<{ configured?: boolean }>(
    params.baseUrl,
    "/admin/bootstrap",
    bootstrapToken,
    { method: "PUT", body: JSON.stringify(payload) },
  );
  if (!bootstrap.ok) {
    throw new Error(
      formatWorkerSyncFailure({
        step: "admin/bootstrap",
        status: bootstrap.status,
        workerError: bootstrap.data.error,
        adminTokenRejected: primary.status === 401,
        bootstrapAttempted: true,
        bootstrapStatus: bootstrap.status,
        bootstrapError: bootstrap.data.error,
      }),
    );
  }
}

function formatWorkerSyncFailure(params: {
  step: string;
  status: number;
  workerError?: string;
  adminTokenRejected: boolean;
  bootstrapAttempted: boolean;
  bootstrapStatus?: number;
  bootstrapError?: string;
}): string {
  const parts: string[] = [];

  if (params.bootstrapAttempted) {
    parts.push(
      "Could not sync credentials to the Relaybase worker.",
      `Worker rejected the admin service token (${params.adminTokenRejected ? "401 Unauthorized" : `HTTP ${params.status}`}).`,
      `Bootstrap via /admin/bootstrap also failed (${params.bootstrapStatus ?? "unknown"}${params.bootstrapError ? `: ${params.bootstrapError}` : ""}).`,
      "Fix: ensure the Cloudflare API token in admin/.env.local matches the worker secret CF_API_TOKEN (run `wrangler secret put CF_API_TOKEN` from the relaybase worker project), then click Sync to worker again.",
    );
  } else if (params.adminTokenRejected) {
    parts.push(
      "Worker rejected the admin service token (401 Unauthorized).",
      "No bootstrap token was available.",
      "Fix: set RELAYBASE_CF_API_TOKEN in admin/.env.local to match the worker CF_API_TOKEN secret, then click Sync to worker.",
    );
  } else {
    parts.push(
      `Worker sync failed on ${params.step} (HTTP ${params.status}${params.workerError ? `: ${params.workerError}` : ""}).`,
      "Check RELAYBASE_URL and worker logs, then try Sync to worker again.",
    );
  }

  return parts.join(" ");
}
