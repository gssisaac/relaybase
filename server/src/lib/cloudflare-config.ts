import type { Env } from "../env";
import { CloudflareClient } from "./cloudflare-client";

export type CloudflareRuntimeConfig = {
  accountId: string;
  apiToken: string;
};

const KV_KEY = "config:cloudflare";

export async function readCloudflareRuntimeConfig(
  env: Env,
): Promise<CloudflareRuntimeConfig | null> {
  const raw = await env.KEYS.get(KV_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as CloudflareRuntimeConfig;
    if (parsed.accountId?.trim() && parsed.apiToken?.trim()) {
      return {
        accountId: parsed.accountId.trim(),
        apiToken: parsed.apiToken.trim(),
      };
    }
  }

  const accountId = env.CF_ACCOUNT_ID?.trim() ?? "";
  const apiToken = env.CF_API_TOKEN?.trim() ?? "";
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

export async function writeCloudflareRuntimeConfig(
  kv: KVNamespace,
  config: CloudflareRuntimeConfig,
): Promise<void> {
  await kv.put(
    KV_KEY,
    JSON.stringify({
      accountId: config.accountId.trim(),
      apiToken: config.apiToken.trim(),
    }),
  );
}

export async function createCloudflareClient(env: Env): Promise<CloudflareClient> {
  const config = await readCloudflareRuntimeConfig(env);
  if (!config) {
    throw new Error(
      "Cloudflare Email Sending is not configured on this worker — set account ID and API token in the ops-dashboard Relaybase settings",
    );
  }
  return new CloudflareClient({
    accountId: config.accountId,
    apiToken: config.apiToken,
  });
}

export async function cloudflareRuntimeConfigured(env: Env): Promise<boolean> {
  return (await readCloudflareRuntimeConfig(env)) !== null;
}
