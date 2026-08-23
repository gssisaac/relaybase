import type { Env } from "../env";
import { CloudflareClient } from "./cloudflare-client";

export type CloudflareRuntimeConfig = {
  accountId: string;
  apiToken: string;
};

/**
 * Read the Worker's Cloudflare runtime credentials from wrangler secrets
 * `CF_ACCOUNT_ID` + `CF_API_TOKEN` (dashboard secret or optional Settings
 * paste-and-push). Used for Email Routing / DNS / zone API — not for send
 * when the EMAIL binding is present. If the secrets are absent this returns
 * null and `createCloudflareClient` throws a clear "not configured" error.
 */
export async function readCloudflareRuntimeConfig(
  env: Env,
): Promise<CloudflareRuntimeConfig | null> {
  const accountId = env.CF_ACCOUNT_ID?.trim() ?? "";
  const apiToken = env.CF_API_TOKEN?.trim() ?? "";
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

export async function createCloudflareClient(env: Env): Promise<CloudflareClient> {
  const config = await readCloudflareRuntimeConfig(env);
  if (!config) {
    throw new Error(
      "Cloudflare API is not configured on this worker — add a CF_API_TOKEN secret (Email Sending + Email Routing + Zone Read) so the Worker can manage domains and DNS",
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

