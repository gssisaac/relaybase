"use client";

import {
  desktopAwareFetch,
  readResponseJson,
  resolveEmailApiBase,
} from "@/lib/desktop/api";
import { scaleApi } from "@/lib/scale/api";
import {
  loadApiKeyVaultEntries,
  mergeKeysWithVault,
  rememberApiKey,
} from "@/lib/desktop/vault/api-key-vault";

const SCALE_SEND_KEY_LABEL = "Scale Broadcast";

type WorkerKeyRow = {
  id: string;
  domain: string;
  label: string | null;
  active: boolean;
  apiKey?: string | null;
};

/**
 * Ensure hq/scale has a domain-scoped Worker API key before dispatch.
 * Issues or reuses a key labeled "Scale Broadcast" and PATCHes account-link.
 */
export async function syncScaleSendCredentials(input: {
  apiBase: string;
  sendingDomain: string;
}): Promise<void> {
  const workerUrl = resolveEmailApiBase();
  if (!workerUrl) {
    throw new Error("Worker is not connected. Finish setup to send broadcasts.");
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
      k.label === SCALE_SEND_KEY_LABEL &&
      k.apiKey,
  );

  if (!match?.apiKey) {
    const createRes = await desktopAwareFetch(`${input.apiBase}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, label: SCALE_SEND_KEY_LABEL }),
    });
    const created = await readResponseJson<{
      id?: string;
      domain?: string;
      label?: string | null;
      apiKey?: string;
      error?: string;
    }>(createRes);
    if (!createRes.ok || !created.apiKey || !created.id) {
      throw new Error(created.error ?? "Could not issue Scale send API key");
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
      label: created.label ?? SCALE_SEND_KEY_LABEL,
      active: true,
      apiKey: created.apiKey,
    };
  }

  await scaleApi.updateAccountLink({
    workerUrl,
    domain,
    sendApiKey: match.apiKey!,
  });
}
