export type RelaybaseSettingField = "workerUrl";

export type RelaybaseEnvSources = Record<RelaybaseSettingField, boolean>;

export type RelaybaseEnvSettings = {
  workerUrl: string;
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

  const sources: RelaybaseEnvSources = {
    workerUrl: Boolean(workerUrl),
  };

  return {
    workerUrl,
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
