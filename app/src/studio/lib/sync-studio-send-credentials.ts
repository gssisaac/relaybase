"use client";

import {
  desktopAwareFetch,
  readResponseJson,
  resolveEmailApiBase,
} from "@/lib/desktop/api";
import { studioApi } from "@/lib/studio/api";
import {
  loadApiKeyVaultEntries,
  mergeKeysWithVault,
  rememberApiKey,
} from "@/lib/desktop/vault/api-key-vault";

const STUDIO_SEND_KEY_LABEL = "Studio Newsletter";

type WorkerKeyRow = {
  id: string;
  domain: string;
  label: string | null;
  active: boolean;
  apiKey?: string | null;
};

/**
 * Ensure hq/studio has a domain-scoped Worker API key before dispatch.
 * Issues or reuses a key labeled "Studio Newsletter" and PATCHes account-link.
 */
export async function syncStudioSendCredentials(input: {
  apiBase: string;
  sendingDomain: string;
}): Promise<void> {
  const workerUrl = resolveEmailApiBase();
  if (!workerUrl) {
    throw new Error("Worker is not connected. Finish setup to send newsletters.");
  }

  const domain = input.sendingDomain.trim().toLowerCase();
  if (!domain) {
    throw new Error("Select a sending domain before sending.");
  }

  const listRes = await desktopAwareFetch(`${input.apiBase}/keys`);
  const listData = await readResponseJson<{ keys?: WorkerKeyRow[]; error?: string }>(listRes);
  if (!listRes.ok) {
    throw new Error(listData.error ?? "Could not load API keys from Worker");
  }

  const vault = await loadApiKeyVaultEntries();
  const keys = mergeKeysWithVault(listData.keys ?? [], vault);
  let match = keys.find(
    (k) =>
      k.domain.toLowerCase() === domain &&
      k.active &&
      k.label === STUDIO_SEND_KEY_LABEL &&
      k.apiKey,
  );

  if (!match?.apiKey) {
    const createRes = await desktopAwareFetch(`${input.apiBase}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, label: STUDIO_SEND_KEY_LABEL }),
    });
    const created = await readResponseJson<{
      id?: string;
      domain?: string;
      label?: string | null;
      apiKey?: string;
      error?: string;
    }>(createRes);
    if (!createRes.ok || !created.apiKey || !created.id) {
      throw new Error(created.error ?? "Could not issue Studio send API key");
    }
    await rememberApiKey({
      id: created.id,
      domain: created.domain ?? domain,
      label: created.label,
      apiKey: created.apiKey,
    });
    match = {
      id: created.id,
      domain: created.domain ?? domain,
      label: created.label ?? STUDIO_SEND_KEY_LABEL,
      active: true,
      apiKey: created.apiKey,
    };
  }

  await studioApi.updateAccountLink({
    workerUrl,
    domain,
    sendApiKey: match.apiKey!,
  });
}
