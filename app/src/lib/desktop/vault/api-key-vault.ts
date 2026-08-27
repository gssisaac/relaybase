"use client";

import {
  desktopGetApiKeyVault,
  desktopRemoveApiKeyVaultEntry,
  desktopSaveApiKeyVaultEntry,
  type DesktopApiKeyVaultEntry,
} from "@/lib/desktop/bridge";

/** Local plaintext API key vault → ~/.relaybase/api-keys.json (Tauri). */

export async function loadApiKeyVaultEntries(): Promise<
  DesktopApiKeyVaultEntry[]
> {
  const vault = await desktopGetApiKeyVault();
  return vault.entries ?? [];
}

export async function rememberApiKey(entry: {
  id: string;
  domain: string;
  label?: string | null;
  apiKey: string;
  createdAt?: string;
}): Promise<void> {
  await desktopSaveApiKeyVaultEntry({
    id: entry.id,
    domain: entry.domain,
    label: entry.label ?? null,
    apiKey: entry.apiKey,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  });
}

export async function forgetApiKey(id: string): Promise<void> {
  await desktopRemoveApiKeyVaultEntry(id);
}

/** Merge Worker key metadata with locally stored plaintext secrets. */
export function mergeKeysWithVault<
  T extends { id: string; apiKey?: string | null },
>(keys: T[], vault: DesktopApiKeyVaultEntry[]): T[] {
  const byId = new Map(vault.map((e) => [e.id, e]));
  return keys.map((key) => {
    const local = byId.get(key.id);
    if (!local?.apiKey) return key;
    return { ...key, apiKey: local.apiKey };
  });
}
