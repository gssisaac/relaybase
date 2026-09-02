import type {
  DesktopCredentials,
  DesktopTeamLogin,
  OwnerSessionStatus,
  TeamSessionStatus,
} from "../bridge";

export type ResolveWorkerUrlInput = {
  role: "owner" | "invited";
  ownerStatus?: OwnerSessionStatus | null;
  teamStatus?: TeamSessionStatus | null;
  credentials?: DesktopCredentials | null;
  teamLogin?: DesktopTeamLogin | null;
};

function normalizeWorkerUrl(raw: string | undefined | null): string {
  return raw?.trim().replace(/\/$/, "") ?? "";
}

/**
 * Disk (`~/.relaybase/credentials.json` for owner, `~/.relaybase/team-login.json`
 * for invited) is the primary source of truth for the workspace Worker URL.
 * Keyring tokens authenticate an existing workspace on disk; keyring information
 * must never be used to invent or restore a workspace when ~/.relaybase is missing.
 */
export function resolveWorkerUrl(input: ResolveWorkerUrlInput): string {
  const { role, credentials, teamLogin } = input;
  if (role === "invited") {
    const fromTeamLogin = normalizeWorkerUrl(teamLogin?.workerUrl);
    if (fromTeamLogin) return fromTeamLogin;
    return normalizeWorkerUrl(credentials?.workerUrl);
  }
  return normalizeWorkerUrl(credentials?.workerUrl);
}
