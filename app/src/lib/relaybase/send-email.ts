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
  const cfg = readRelaybaseWorkerConfig();
  if (!cfg) {
    throw new Error("Relaybase worker is not configured");
  }

  const existing = findRelaybaseApiKeyForDomain(domain);
  if (existing?.key) return existing.key;

  const created = await createWorkerApiKey(cfg, {
    domain,
    label: "app-compose",
  });

  upsertRelaybaseApiKeyRecord({
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
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
}): Promise<{ messageId: string }> {
  const cfg = readRelaybaseWorkerConfig();
  if (!cfg) {
    throw new Error("Relaybase worker is not configured");
  }

  const apiKey = await resolveDomainApiKey(params.domain);
  return sendEmailWithApiKey(cfg.baseUrl, apiKey, params);
}
