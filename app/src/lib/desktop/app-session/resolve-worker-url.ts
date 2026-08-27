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
 * Keyring workerUrl is primary; disk (`credentials.json` / `team-login.json`)
 * is fallback for install scope and browser dev.
 */
export function resolveWorkerUrl(input: ResolveWorkerUrlInput): string {
  const { role, ownerStatus, teamStatus, credentials, teamLogin } = input;
  if (role === "invited") {
    const fromKeyring = normalizeWorkerUrl(teamStatus?.workerUrl);
    if (fromKeyring) return fromKeyring;
    const fromTeamLogin = normalizeWorkerUrl(teamLogin?.workerUrl);
    if (fromTeamLogin) return fromTeamLogin;
    return normalizeWorkerUrl(credentials?.workerUrl);
  }
  const fromKeyring = normalizeWorkerUrl(ownerStatus?.workerUrl);
  if (fromKeyring) return fromKeyring;
  return normalizeWorkerUrl(credentials?.workerUrl);
}
