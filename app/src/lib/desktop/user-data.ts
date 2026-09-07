import { invoke, isDesktopRuntime } from "./bridge/invoke";
import { loadLocalCredentialsFile } from "./bridge/credentials-local";
import type { DesktopCredentials } from "./bridge/credentials";

export type UserConnectionData = {
  workerUrl: string;
  accountId: string;
  workerScriptName: string;
  workerVersion: string;
};

export type SaveUserConnectionInput = {
  workerUrl: string;
  accountId?: string | null;
  workerScriptName?: string | null;
  workerVersion?: string | null;
};

/**
 * Get current user workspace connection data (workerUrl, accountId, scriptName, version).
 */
export async function getUserConnection(): Promise<UserConnectionData | null> {
  if (isDesktopRuntime()) {
    return invoke("get_user_connection");
  }
  const creds = await loadLocalCredentialsFile();
  if (!creds?.workerUrl && !creds?.accountId) return null;
  return {
    workerUrl: creds.workerUrl || "",
    accountId: creds.accountId || "",
    workerScriptName: creds.workerScriptName || "relaybase-api",
    workerVersion: creds.workerVersion || "",
  };
}

/**
 * Atomically save workspace connection data (workerUrl + accountId + scriptName + version).
 */
export async function saveUserConnection(
  input: SaveUserConnectionInput,
): Promise<DesktopCredentials> {
  if (isDesktopRuntime()) {
    return invoke("save_user_connection", {
      workerUrl: input.workerUrl,
      accountId: input.accountId?.trim() || null,
      workerScriptName: input.workerScriptName?.trim() || null,
      workerVersion: input.workerVersion?.trim() || null,
    });
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId:
      input.accountId !== undefined
        ? input.accountId?.trim() ?? ""
        : existing?.accountId ?? "",
    installToken: existing?.installToken ?? "",
    workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
    workerScriptName:
      input.workerScriptName?.trim() ||
      existing?.workerScriptName ||
      "relaybase-api",
    workerVersion:
      input.workerVersion?.trim() || existing?.workerVersion || "",
    relaybaseAccountId: existing?.relaybaseAccountId ?? "",
    relaybaseEmail: existing?.relaybaseEmail ?? "",
    relaybaseSession: existing?.relaybaseSession ?? "",
    cfOauthAccessToken: existing?.cfOauthAccessToken ?? "",
    cfOauthRefreshToken: existing?.cfOauthRefreshToken ?? "",
    cfOauthAccessExpiresAt: existing?.cfOauthAccessExpiresAt ?? "",
    cfOauthAccountId: existing?.cfOauthAccountId ?? "",
    scopeId: existing?.scopeId ?? "",
  };
  const res = await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) {
    throw new Error("Failed to save credentials to ~/.relaybase");
  }
  return next;
}

/**
 * Clear workspace connection data.
 */
export async function clearUserConnection(): Promise<void> {
  if (isDesktopRuntime()) {
    return invoke("clear_user_connection");
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId: "",
    installToken: existing?.installToken ?? "",
    workerUrl: "",
    workerScriptName: "",
    workerVersion: "",
    relaybaseAccountId: existing?.relaybaseAccountId ?? "",
    relaybaseEmail: existing?.relaybaseEmail ?? "",
    relaybaseSession: existing?.relaybaseSession ?? "",
    cfOauthAccessToken: existing?.cfOauthAccessToken ?? "",
    cfOauthRefreshToken: existing?.cfOauthRefreshToken ?? "",
    cfOauthAccessExpiresAt: existing?.cfOauthAccessExpiresAt ?? "",
    cfOauthAccountId: existing?.cfOauthAccountId ?? "",
    scopeId: existing?.scopeId ?? "",
  };
  await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
}
