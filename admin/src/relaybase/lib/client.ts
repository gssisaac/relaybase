import type { EmailSenderConfig } from "./config";
import type {
  EmailSenderLogEntry,
  EmailSenderLogSummary,
} from "@/relaybase/components/types";
import { listWorkerSendLogs } from "./worker-logs";

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
    "/console/keys",
  );
  return data.keys ?? [];
}

export async function createEmailSenderKey(
  cfg: EmailSenderConfig,
  params: { domain: string; label?: string },
): Promise<CreateEmailSenderKeyResult> {
  return emailSenderFetch<CreateEmailSenderKeyResult>(cfg, "/console/keys", {
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
  await emailSenderFetch<{ ok: boolean }>(cfg, `/console/keys/${id}`, {
    method: "DELETE",
  });
}

export type EmailSenderLogsResult = {
  logs: EmailSenderLogEntry[];
  summary: EmailSenderLogSummary;
};

export async function listEmailSenderLogs(
  _cfg: EmailSenderConfig,
  params?: {
    limit?: number;
    status?: "all" | "failed" | "success";
    domain?: string;
  },
): Promise<EmailSenderLogsResult> {
  return listWorkerSendLogs(params);
}

export async function sendEmailWithApiKey(
  baseUrl: string,
  apiKey: string,
  params: {
    from: string;
    fromName?: string;
    to: string | string[];
    cc?: string | string[];
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
    "/console/keys",
    trimmed,
  );
  return result.ok;
}

export async function syncWorkerRuntimeConfig(params: {
  baseUrl: string;
  adminToken: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  workerScriptName?: string;
  bootstrapToken?: string;
}): Promise<void> {
  // Operator-only runtime config sync now writes the worker's KV directly
  // through the Cloudflare API from the admin server, instead of proxying
  // through the worker's former /admin/bootstrap and /admin/cloudflare
  // endpoints (those routes have been removed from the worker).
  const { syncWorkerRuntimeConfig: syncKv } = await import("./worker-config");
  try {
    await syncKv({
      cloudflareAccountId: params.cloudflareAccountId,
      cloudflareApiToken: params.cloudflareApiToken,
      adminToken: params.adminToken,
      workerScriptName: params.workerScriptName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      formatWorkerSyncFailure({
        workerError: message,
      }),
    );
  }
}

function formatWorkerSyncFailure(params: {
  workerError?: string;
}): string {
  const parts: string[] = [
    "Could not sync credentials to the Relaybase worker.",
  ];
  if (params.workerError) {
    parts.push(`Reason: ${params.workerError}`);
  }
  parts.push(
    "Fix: ensure the Cloudflare API token in admin/.env.local has Workers Scripts (read) and Workers KV Storage (edit) permissions, the worker is deployed with a KV namespace bound as RELAYBASE_APP, then click Sync to worker again.",
  );
  return parts.join(" ");
}
