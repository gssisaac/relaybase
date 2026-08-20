import type { Env } from "../env";
import { CloudflareClient } from "./cloudflare-client";

export type CloudflareRuntimeConfig = {
  accountId: string;
  apiToken: string;
};

/**
 * Read the Worker's Cloudflare runtime credentials from wrangler secrets
 * `CF_ACCOUNT_ID` + `CF_API_TOKEN` (pushed by the desktop install / Settings
 * "push server token" flow). If the secrets are absent (e.g. the user skipped
 * the server token during install), this returns null and
 * `createCloudflareClient` throws a clear "not configured" error.
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

