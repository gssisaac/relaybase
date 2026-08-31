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

const HQ_WORKER_RETIRED =
  "HQ admin no longer authenticates to the product Worker. Use the desktop app with an owner passtoken.";

async function emailSenderFetch<T>(
  _cfg: EmailSenderConfig,
  _path: string,
  _init?: RequestInit,
): Promise<T> {
  throw new Error(HQ_WORKER_RETIRED);
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

export async function sendEmailWithAdminToken(
  _cfg: EmailSenderConfig,
  _params: {
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
  throw new Error(HQ_WORKER_RETIRED);
}
