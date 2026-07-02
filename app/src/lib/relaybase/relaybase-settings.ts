import {
  readProductJson,
  writeProductJson,
} from "@/lib/config/product-store";

const RELAYBASE_STORE_ID = "relaybase";
const SETTINGS_FILE = "settings.json";

export type RelaybaseApiKeyRecord = {
  id: string;
  domain: string;
  label: string | null;
  keyPrefix: string;
  key: string;
  createdAt: string;
};

type RelaybaseSettingsSlice = {
  apiKeyVault?: RelaybaseApiKeyRecord[];
};

export function readRelaybaseApiKeyVault(): RelaybaseApiKeyRecord[] {
  const stored =
    readProductJson<RelaybaseSettingsSlice>(RELAYBASE_STORE_ID, SETTINGS_FILE) ??
    {};
  return stored.apiKeyVault ?? [];
}

export function findRelaybaseApiKeyForDomain(
  domain: string,
): RelaybaseApiKeyRecord | null {
  const normalized = domain.trim().toLowerCase();
  return (
    readRelaybaseApiKeyVault().find(
      (entry) => entry.domain.trim().toLowerCase() === normalized && entry.key,
    ) ?? null
  );
}

export function upsertRelaybaseApiKeyRecord(
  record: RelaybaseApiKeyRecord,
): RelaybaseApiKeyRecord {
  const stored =
    readProductJson<Record<string, unknown>>(RELAYBASE_STORE_ID, SETTINGS_FILE) ??
    {};
  const vault = readRelaybaseApiKeyVault().filter((entry) => entry.id !== record.id);
  writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, {
    ...stored,
    apiKeyVault: [...vault, record],
  });
  return record;
}
