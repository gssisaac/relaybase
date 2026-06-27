export type RelaybaseSettingField =
  | "workerUrl"
  | "cloudflareAccountId"
  | "cloudflareApiToken"
  | "cloudflareZoneId"
  | "cloudflareDnsApiToken"
  | "inboundR2BucketName";

export type RelaybaseEnvSources = Record<RelaybaseSettingField, boolean>;

export type RelaybaseEnvSettings = {
  workerUrl: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  cloudflareZoneId: string;
  cloudflareDnsApiToken: string;
  inboundR2BucketName: string;
  sources: RelaybaseEnvSources;
};

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function trimUrl(value: string | undefined): string {
  return trim(value).replace(/\/$/, "");
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = trim(value);
    if (trimmed) return trimmed;
  }
  return "";
}

export function readRelaybaseEnvSettings(): RelaybaseEnvSettings {
  const workerUrl = firstNonEmpty(
    trimUrl(process.env.RELAYBASE_URL),
    trimUrl(process.env.FLARE_EMAIL_SENDER_URL),
  );
  const cloudflareAccountId = firstNonEmpty(
    process.env.RELAYBASE_CF_ACCOUNT_ID,
    process.env.FLARE_EMAIL_SENDER_CF_ACCOUNT_ID,
    process.env.CLOUDFLARE_ACCOUNT_ID,
  );
  const cloudflareApiToken = firstNonEmpty(
    process.env.RELAYBASE_CF_API_TOKEN,
    process.env.FLARE_EMAIL_SENDER_CF_API_TOKEN,
    process.env.CLOUDFLARE_API_TOKEN,
  );
  const cloudflareZoneId = firstNonEmpty(
    process.env.RELAYBASE_CF_ZONE_ID,
    process.env.FLARE_EMAIL_SENDER_CF_ZONE_ID,
    process.env.CLOUDFLARE_ZONE_ID,
  );
  const cloudflareDnsApiToken = firstNonEmpty(
    process.env.RELAYBASE_CF_DNS_API_TOKEN,
    process.env.FLARE_EMAIL_SENDER_CF_DNS_API_TOKEN,
  );
  const inboundR2BucketName = firstNonEmpty(
    process.env.RELAYBASE_INBOUND_R2_BUCKET,
    process.env.FLARE_EMAIL_SENDER_INBOUND_R2_BUCKET,
  );

  const sources: RelaybaseEnvSources = {
    workerUrl: Boolean(workerUrl),
    cloudflareAccountId: Boolean(cloudflareAccountId),
    cloudflareApiToken: Boolean(cloudflareApiToken),
    cloudflareZoneId: Boolean(cloudflareZoneId),
    cloudflareDnsApiToken: Boolean(cloudflareDnsApiToken),
    inboundR2BucketName: Boolean(inboundR2BucketName),
  };

  return {
    workerUrl,
    cloudflareAccountId,
    cloudflareApiToken,
    cloudflareZoneId,
    cloudflareDnsApiToken,
    inboundR2BucketName,
    sources,
  };
}

export function resolveSettingValue(
  field: RelaybaseSettingField,
  stored: string,
  env: RelaybaseEnvSettings,
): string {
  return env.sources[field] ? env[field] : stored;
}
