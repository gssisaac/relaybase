import { CloudflareClient } from "@/lib/cloudflare/client";
import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import { readEmailSenderSettings } from "@/relaybase/lib/settings";

export type CloudflareRuntimeConfig = {
  accountId: string;
  apiToken: string;
};

export const DEFAULT_WORKER_SCRIPT_NAME = "relaybase-api";
export const DEFAULT_KV_NAMESPACE_TITLE = "relaybase-app";

const KV_KEY_CLOUDFLARE = "srv:config:cloudflare";
const KV_KEY_ADMIN = "srv:config:admin";

/**
 * Resolve the worker script name to target for KV writes. Prefers an
 * explicitly stored value, then env, then the hosted default.
 */
export async function resolveWorkerScriptName(): Promise<string> {
  const settings = await readEmailSenderSettings();
  const env = readRelaybaseEnvSettings();
  const stored = settings.workerScriptName?.trim();
  if (stored) return stored;
  if (env.workerScriptName) return env.workerScriptName;
  return DEFAULT_WORKER_SCRIPT_NAME;
}

async function createClient(): Promise<CloudflareClient> {
  const settings = await readEmailSenderSettings();
  const env = readRelaybaseEnvSettings();
  const accountId = env.cloudflareAccountId || settings.cloudflareAccountId;
  const apiToken = env.cloudflareApiToken || settings.cloudflareApiToken;
  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare account ID and API token are required in Relaybase settings.",
    );
  }
  return CloudflareClient.create({ accountId, apiToken });
}

async function resolveKvNamespaceId(
  client: CloudflareClient,
  scriptName: string,
): Promise<string> {
  const namespaceId = await client.resolveWorkerKvNamespaceId(
    scriptName,
    "RELAYBASE_APP",
    DEFAULT_KV_NAMESPACE_TITLE,
  );
  if (!namespaceId) {
    throw new Error(
      `Could not resolve the RELAYBASE_APP KV namespace for worker "${scriptName}". Ensure the worker is deployed with a KV namespace bound as RELAYBASE_APP, or create a KV namespace titled "${DEFAULT_KV_NAMESPACE_TITLE}".`,
    );
  }
  return namespaceId;
}

/**
 * Write the Cloudflare account ID + API token the worker uses to send mail.
 * Replaces the worker's former PUT /admin/cloudflare endpoint.
 */
export async function writeWorkerCloudflareRuntimeConfig(
  scriptName: string,
  config: CloudflareRuntimeConfig,
): Promise<void> {
  const accountId = config.accountId.trim();
  const apiToken = config.apiToken.trim();
  if (!accountId || !apiToken) {
    throw new Error("accountId and apiToken are required");
  }
  const client = await createClient();
  const namespaceId = await resolveKvNamespaceId(client, scriptName);
  await client.putKvValue(
    namespaceId,
    KV_KEY_CLOUDFLARE,
    JSON.stringify({ accountId, apiToken }),
  );
}

/**
 * Store the admin service token the worker accepts on /console/* and /mail/*
 * routes. Replaces the worker's former PUT /admin/bootstrap admin-token step.
 */
export async function setWorkerAdminToken(
  scriptName: string,
  adminToken: string,
): Promise<void> {
  const token = adminToken.trim();
  if (!token) throw new Error("adminToken is required");
  const client = await createClient();
  const namespaceId = await resolveKvNamespaceId(client, scriptName);
  await client.putKvValue(
    namespaceId,
    KV_KEY_ADMIN,
    JSON.stringify({ token }),
  );
}

/**
 * Sync both the Cloudflare runtime config and the admin service token to the
 * worker's KV in one pass. Replaces the former syncWorkerRuntimeConfig worker
 * proxy flow (PUT /admin/cloudflare with bootstrap fallback).
 */
export async function syncWorkerRuntimeConfig(params: {
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  adminToken: string;
  workerScriptName?: string;
}): Promise<void> {
  const scriptName = (
    params.workerScriptName?.trim() || (await resolveWorkerScriptName())
  ).trim();
  await writeWorkerCloudflareRuntimeConfig(scriptName, {
    accountId: params.cloudflareAccountId,
    apiToken: params.cloudflareApiToken,
  });
  await setWorkerAdminToken(scriptName, params.adminToken);
}

export async function isWorkerCloudflareRuntimeConfigured(
  scriptName: string,
): Promise<boolean> {
  try {
    const client = await createClient();
    const namespaceId = await resolveKvNamespaceId(client, scriptName);
    const raw = await client.getKvValue(namespaceId, KV_KEY_CLOUDFLARE);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<CloudflareRuntimeConfig>;
    return Boolean(parsed.accountId && parsed.apiToken);
  } catch {
    return false;
  }
}
