import { readProductJson } from "@/lib/config/product-store";
import {
  readRelaybaseEnvSettings,
  resolveSettingValue,
} from "@/lib/relaybase/env-settings";
import type { RoutingActivityEvent } from "@/relaybase-email/components/types";

const RELAYBASE_STORE_ID = "relaybase";
const SETTINGS_FILE = "settings.json";

type StoredRelaybaseSettings = {
  workerUrl?: string;
  adminToken?: string;
};

export type RelaybaseWorkerConfig = {
  baseUrl: string;
  adminToken: string;
};

export function readRelaybaseWorkerConfig(): RelaybaseWorkerConfig | null {
  const env = readRelaybaseEnvSettings();
  const stored =
    readProductJson<StoredRelaybaseSettings>(
      RELAYBASE_STORE_ID,
      SETTINGS_FILE,
    ) ?? {};

  const baseUrl = resolveSettingValue(
    "workerUrl",
    stored.workerUrl?.trim().replace(/\/$/, "") ?? "",
    env,
  );
  const adminToken = stored.adminToken?.trim() ?? "";
  if (!baseUrl || !adminToken) return null;
  return { baseUrl, adminToken };
}

async function workerFetch<T>(
  cfg: RelaybaseWorkerConfig,
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
      error instanceof TypeError ? ` — cannot reach ${cfg.baseUrl}` : "";
    throw new Error(`Relaybase request failed${hint}`);
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Relaybase request failed (${res.status})`);
  }
  return data;
}

export async function listInboundMessages(
  cfg: RelaybaseWorkerConfig,
  domain: string,
  limit = 50,
): Promise<RoutingActivityEvent[]> {
  const search = new URLSearchParams({
    domain: domain.trim().toLowerCase(),
    limit: String(limit),
  });
  const data = await workerFetch<{ messages?: RoutingActivityEvent[] }>(
    cfg,
    `/admin/inbox?${search.toString()}`,
  );
  return data.messages ?? [];
}

export async function getInboundMessage(
  cfg: RelaybaseWorkerConfig,
  domain: string,
  id: string,
): Promise<RoutingActivityEvent> {
  const search = new URLSearchParams({
    domain: domain.trim().toLowerCase(),
  });
  const data = await workerFetch<{ message?: RoutingActivityEvent }>(
    cfg,
    `/admin/inbox/${encodeURIComponent(id)}?${search.toString()}`,
  );
  if (!data.message) {
    throw new Error("Message not found");
  }
  return data.message;
}

export type CreateWorkerApiKeyResult = {
  id: string;
  apiKey: string;
  domain: string;
  label: string | null;
  createdAt: string;
};

export async function createWorkerApiKey(
  cfg: RelaybaseWorkerConfig,
  params: { domain: string; label?: string },
): Promise<CreateWorkerApiKeyResult> {
  return workerFetch<CreateWorkerApiKeyResult>(cfg, "/admin/keys", {
    method: "POST",
    body: JSON.stringify({
      domain: params.domain.trim(),
      label: params.label?.trim() || undefined,
    }),
  });
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

export async function getInboundAttachment(
  cfg: RelaybaseWorkerConfig,
  domain: string,
  messageId: string,
  attachmentId: string,
): Promise<Response> {
  const search = new URLSearchParams({
    domain: domain.trim().toLowerCase(),
  });
  const url = `${cfg.baseUrl}/admin/inbox/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}?${search.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.adminToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Attachment not found (${res.status})`);
  }
  return res;
}
