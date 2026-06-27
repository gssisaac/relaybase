import { readProductJson } from "@/lib/config/product-store";
import {
  readRelaybaseEnvSettings,
  resolveSettingValue,
} from "@/lib/relaybase/env-settings";
import {
  ensureInboundR2Bucket,
  inboundR2ObjectPrefix,
  resolveInboundR2BucketName,
} from "@/lib/relaybase/r2-inbound";
import { platformNotConfiguredError } from "@/lib/relaybase/domain-provision-errors";

const RELAYBASE_STORE_ID = "relaybase";
const SETTINGS_FILE = "settings.json";

type StoredRelaybaseSettings = {
  workerUrl?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  inboundR2BucketName?: string;
};

export type RelaybasePlatformConfig = {
  workerUrl: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  inboundR2BucketName: string;
  cloudflareConfigured: boolean;
};

export function readRelaybasePlatformConfig(): RelaybasePlatformConfig {
  const env = readRelaybaseEnvSettings();
  const stored =
    readProductJson<StoredRelaybaseSettings>(RELAYBASE_STORE_ID, SETTINGS_FILE) ??
    {};

  const workerUrl = resolveSettingValue(
    "workerUrl",
    stored.workerUrl?.trim() ?? "",
    env,
  );
  const cloudflareAccountId = resolveSettingValue(
    "cloudflareAccountId",
    stored.cloudflareAccountId?.trim() ?? "",
    env,
  );
  const cloudflareApiToken = resolveSettingValue(
    "cloudflareApiToken",
    stored.cloudflareApiToken?.trim() ?? "",
    env,
  );
  const inboundR2BucketName = resolveInboundR2BucketName(
    RELAYBASE_STORE_ID,
    resolveSettingValue(
      "inboundR2BucketName",
      stored.inboundR2BucketName?.trim() ?? "",
      env,
    ),
  );

  return {
    workerUrl,
    cloudflareAccountId,
    cloudflareApiToken,
    inboundR2BucketName,
    cloudflareConfigured: Boolean(cloudflareAccountId && cloudflareApiToken),
  };
}

export type WorkerInboundHealth = {
  ok: boolean;
  inbound?: {
    r2Configured: boolean;
    bucketName: string;
  };
};

export async function fetchWorkerInboundHealth(
  workerUrl: string,
): Promise<WorkerInboundHealth> {
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as WorkerInboundHealth;
  } catch {
    return { ok: false };
  }
}

export type DomainR2ProvisionResult = {
  domain: string;
  bucketName: string;
  objectPrefix: string;
  bucketCreated: boolean;
  bucketExists: boolean;
  workerReady: boolean;
  workerBucketName: string | null;
  message: string;
};

export async function provisionDomainInboundR2(
  domain: string,
): Promise<DomainR2ProvisionResult> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Domain is required");
  }

  const platform = readRelaybasePlatformConfig();
  if (!platform.cloudflareConfigured) {
    throw platformNotConfiguredError();
  }

  const r2 = await ensureInboundR2Bucket({
    accountId: platform.cloudflareAccountId,
    apiToken: platform.cloudflareApiToken,
    bucketName: platform.inboundR2BucketName,
  });

  const objectPrefix = inboundR2ObjectPrefix(normalized);
  let workerReady = false;
  let workerBucketName: string | null = null;

  if (platform.workerUrl) {
    const health = await fetchWorkerInboundHealth(platform.workerUrl);
    workerReady = health.inbound?.r2Configured === true;
    workerBucketName = health.inbound?.bucketName ?? null;
  }

  const message = r2.created
    ? `Created inbound R2 bucket ${r2.bucketName} for ${normalized}.`
    : `Inbound R2 bucket ${r2.bucketName} is ready for ${normalized}.`;

  return {
    domain: normalized,
    bucketName: r2.bucketName,
    objectPrefix,
    bucketCreated: r2.created,
    bucketExists: true,
    workerReady,
    workerBucketName,
    message,
  };
}
