import { invoke, isDesktopRuntime } from "./invoke";
import { loadLocalCredentialsFile } from "./credentials-local";

export type DesktopCredentials = {
  accountId: string;
  /** Unused IPC leftover. OAuth is `cfOauthAccessToken` only. */
  installToken: string;
  workerUrl: string;
  workerScriptName: string;
  /** Deployed Worker bundle version (WORKER_VERSION). */
  workerVersion: string;
  /** Relaybase console account (console.relaybase.xyz). */
  relaybaseAccountId: string;
  relaybaseEmail: string;
  /** Signed session token, stored locally only. */
  relaybaseSession: string;
  /** Memory overlay of the OAuth access token. Never persisted. */
  cfOauthAccessToken: string;
  // Long-lived refresh token; process memory only (Tauri desktop).
  cfOauthRefreshToken: string;
  // ISO timestamp of access-token expiry.
  cfOauthAccessExpiresAt: string;
  // Cloudflare account id resolved from the OAuth flow.
  cfOauthAccountId: string;
};

export async function desktopGetCredentials(): Promise<DesktopCredentials | null> {
  return invoke("get_credentials");
}

export async function desktopSaveCfCredentials(
  accountId: string,
): Promise<DesktopCredentials> {
  return invoke("save_cf_credentials", { accountId });
}

export async function desktopSaveRelaybaseAccount(input: {
  accountId: string;
  email: string;
  session: string;
}): Promise<DesktopCredentials> {
  if (isDesktopRuntime()) {
    return invoke("save_relaybase_account", {
      accountId: input.accountId,
      email: input.email,
      session: input.session,
    });
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId: existing?.accountId ?? "",
    installToken: existing?.installToken ?? "",
    workerUrl: existing?.workerUrl ?? "",
    workerScriptName: existing?.workerScriptName ?? "",
    workerVersion: existing?.workerVersion ?? "",
    relaybaseAccountId: input.accountId,
    relaybaseEmail: input.email,
    relaybaseSession: input.session,
    cfOauthAccessToken: existing?.cfOauthAccessToken ?? "",
    cfOauthRefreshToken: existing?.cfOauthRefreshToken ?? "",
    cfOauthAccessExpiresAt: existing?.cfOauthAccessExpiresAt ?? "",
    cfOauthAccountId: existing?.cfOauthAccountId ?? "",
  };
  const res = await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) throw new Error("Failed to save Relaybase account to ~/.relaybase");
  return next;
}

export async function desktopClearRelaybaseAccount(): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("clear_relaybase_account");
    return;
  }
  const existing = await loadLocalCredentialsFile();
  if (!existing) return;
  const next: DesktopCredentials = {
    ...existing,
    relaybaseAccountId: "",
    relaybaseEmail: "",
    relaybaseSession: "",
  };
  await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
}

export async function desktopClearCredentials(): Promise<void> {
  if (isDesktopRuntime()) {
    return invoke("clear_stored_credentials");
  }
  await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: "",
      workerUrl: "",
      workerScriptName: "",
      workerVersion: "",
    }),
  });
}
