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

export async function readRelaybaseApiKeyVault(): Promise<RelaybaseApiKeyRecord[]> {
  const stored =
    (await readProductJson<RelaybaseSettingsSlice>(RELAYBASE_STORE_ID, SETTINGS_FILE)) ??
    {};
  return stored.apiKeyVault ?? [];
}

export async function findRelaybaseApiKeyForDomain(
  domain: string,
): Promise<RelaybaseApiKeyRecord | null> {
  const normalized = domain.trim().toLowerCase();
  return (
    (await readRelaybaseApiKeyVault()).find(
      (entry) => entry.domain.trim().toLowerCase() === normalized && entry.key,
    ) ?? null
  );
}

async function writeApiKeyVault(vault: RelaybaseApiKeyRecord[]): Promise<void> {
  const stored =
    (await readProductJson<Record<string, unknown>>(RELAYBASE_STORE_ID, SETTINGS_FILE)) ??
    {};
  await writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, {
    ...stored,
    apiKeyVault: vault,
  });
}

export async function upsertRelaybaseApiKeyRecord(
  record: RelaybaseApiKeyRecord,
): Promise<RelaybaseApiKeyRecord> {
  const vault = (await readRelaybaseApiKeyVault()).filter((entry) => entry.id !== record.id);
  // Newest preferred key first so findRelaybaseApiKeyForDomain picks it up.
  await writeApiKeyVault([record, ...vault]);
  return record;
}

export async function preferRelaybaseApiKeyRecord(id: string): Promise<boolean> {
  const vault = await readRelaybaseApiKeyVault();
  const preferred = vault.find((entry) => entry.id === id);
  if (!preferred) return false;
  const rest = vault.filter((entry) => entry.id !== id);
  await writeApiKeyVault([preferred, ...rest]);
  return true;
}

export async function removeRelaybaseApiKeyRecord(id: string): Promise<void> {
  const vault = (await readRelaybaseApiKeyVault()).filter((entry) => entry.id !== id);
  await writeApiKeyVault(vault);
}
