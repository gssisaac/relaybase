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
  /** Persisted opaque scope id for the active workspace. */
  scopeId: string;
};

export type WorkspaceEntry = {
  accountId: string;
  workerUrl: string;
  workerScriptName: string;
  workerVersion: string;
  relaybaseAccountId: string;
  relaybaseEmail: string;
  relaybaseSession: string;
  /** Persisted opaque scope id (`s-{16hex}`). */
  scopeId: string;
  lastUsedAt: string;
};

export type Workspaces = {
  version: number;
  lastActiveKey: string;
  workspaces: Record<string, WorkspaceEntry>;
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
    scopeId: existing?.scopeId ?? "",
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

// --- Workspaces keymap ---

export async function desktopListWorkspaces(): Promise<Workspaces> {
  if (!isDesktopRuntime()) {
    return { version: 1, lastActiveKey: "", workspaces: {} };
  }
  return invoke("list_workspaces_cmd");
}

export async function desktopGetActiveWorkspace(): Promise<WorkspaceEntry | null> {
  if (!isDesktopRuntime()) return null;
  return invoke("get_active_workspace");
}

export async function desktopSetActiveWorkspace(key: string): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("set_active_workspace_cmd", { key });
}

export async function desktopRemoveWorkspace(key: string): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("remove_workspace_cmd", { key });
}

export async function desktopUpsertActiveWorkspace(
  entry: WorkspaceEntry,
): Promise<string> {
  if (!isDesktopRuntime()) return "";
  return invoke("upsert_active_workspace_cmd", { entry });
}
