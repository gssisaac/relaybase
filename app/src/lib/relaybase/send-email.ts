import {
  findRelaybaseApiKeyForDomain,
  upsertRelaybaseApiKeyRecord,
} from "@/lib/relaybase/relaybase-settings";
import {
  createWorkerApiKey,
  readRelaybaseWorkerConfig,
  sendEmailWithApiKey,
} from "@/lib/relaybase/worker-client";

async function resolveDomainApiKey(domain: string): Promise<string> {
  const cfg = await readRelaybaseWorkerConfig();
  if (!cfg) {
    throw new Error("Relaybase worker is not configured");
  }

  const existing = await findRelaybaseApiKeyForDomain(domain);
  if (existing?.key) return existing.key;

  const created = await createWorkerApiKey(cfg, {
    domain,
    label: "app-compose",
  });

  await upsertRelaybaseApiKeyRecord({
    id: created.id,
    domain: created.domain,
    label: created.label,
    keyPrefix: created.apiKey.replace(/^fes_/, "").slice(0, 8),
    key: created.apiKey,
    createdAt: created.createdAt,
  });

  return created.apiKey;
}

export async function sendViaRelaybaseWorker(params: {
  domain: string;
  from: string;
  fromName?: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ messageId: string }> {
  const cfg = await readRelaybaseWorkerConfig();
  if (!cfg) {
    throw new Error("Relaybase worker is not configured");
  }

  const apiKey = await resolveDomainApiKey(params.domain);
  return sendEmailWithApiKey(cfg.baseUrl, apiKey, params);
}
