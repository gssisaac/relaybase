import type { Env } from "../env";
import { normalizeCfAccountId } from "./cf-account-id.ts";
import { CloudflareClient } from "./cloudflare-client.ts";

export type CloudflareRuntimeConfig = {
  /** May be empty — resolve from the token when an id is needed. */
  accountId: string;
  apiToken: string;
};

/**
 * Read the Worker's Cloudflare runtime credentials. `CF_API_TOKEN` is
 * required. `CF_ACCOUNT_ID` is optional (dashboard secret or install PUT).
 * Used for Email Routing / DNS / zone API — not for send when the EMAIL
 * binding is present. Missing token returns null; missing account id does not.
 */
export async function readCloudflareRuntimeConfig(
  env: Env,
): Promise<CloudflareRuntimeConfig | null> {
  const apiToken = env.CF_API_TOKEN?.trim() ?? "";
  if (!apiToken) return null;
  const accountId = normalizeCfAccountId(env.CF_ACCOUNT_ID) ?? "";
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
