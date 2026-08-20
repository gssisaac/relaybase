import {
  desktopClearCredentials,
  desktopClearRelaybaseAccount,
  desktopClearTeamLogin,
} from "@/lib/desktop/bridge";

/** Entry screen after sign-out (welcome/setup or team login). */
export function signOutRedirectPath(isTeam: boolean): string {
  return isTeam ? "/login" : "/setup";
}

export async function signOutRelaybase(isTeam: boolean): Promise<void> {
  if (isTeam) {
    await desktopClearTeamLogin();
    return;
  }
  await desktopClearCredentials();
  await desktopClearRelaybaseAccount();
}
