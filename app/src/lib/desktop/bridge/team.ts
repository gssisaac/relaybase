import { invoke, isDesktopRuntime } from "./invoke";

export type DesktopTeamLogin = {
  workerUrl: string;
  accountEmail: string;
  mobilePassword: string;
};

export async function desktopGetTeamLogin(): Promise<DesktopTeamLogin | null> {
  if (isDesktopRuntime()) {
    return invoke("get_team_login");
  }
  return null;
}

export async function desktopSaveTeamLogin(input: {
  workerUrl: string;
  accountEmail: string;
  mobilePassword: string;
}): Promise<DesktopTeamLogin> {
  if (isDesktopRuntime()) {
    return invoke("save_team_login_cmd", {
      workerUrl: input.workerUrl,
      accountEmail: input.accountEmail,
      mobilePassword: input.mobilePassword,
    });
  }
  return {
    workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
    accountEmail: input.accountEmail.trim().toLowerCase(),
    mobilePassword: input.mobilePassword,
  };
}

export async function desktopClearTeamLogin(): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("clear_team_login_cmd");
  }
}

export type TeamSessionStatus = {
  hasSecret: boolean;
  hasAccess: boolean;
  accountEmail: string;
  workerUrl: string;
  platform: string;
};

export async function desktopTeamSessionStatus(): Promise<TeamSessionStatus> {
  if (!isDesktopRuntime()) {
    return {
      hasSecret: false,
      hasAccess: false,
      accountEmail: "",
      workerUrl: "",
      platform: "other",
    };
  }
  return invoke("team_session_status_cmd");
}

export async function desktopTeamLogin(input: {
  workerUrl: string;
  accountEmail: string;
  mobilePassword: string;
}): Promise<TeamSessionStatus> {
  return invoke("team_login_cmd", {
    workerUrl: input.workerUrl,
    accountEmail: input.accountEmail,
    mobilePassword: input.mobilePassword,
  });
}

export async function desktopTeamUnlock(): Promise<TeamSessionStatus> {
  return invoke("team_unlock_cmd");
}

export async function desktopTeamLogout(): Promise<void> {
  await invoke("team_logout_cmd");
}

export async function desktopTeamForgetSession(): Promise<TeamSessionStatus> {
  if (isDesktopRuntime()) {
    return invoke("team_forget_session_cmd");
  }
  await desktopClearTeamLogin();
  return desktopTeamSessionStatus();
}

export async function desktopTeamWorkerRequest(input: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; headers: [string, string][]; body: string }> {
  return invoke("team_worker_request_cmd", { input });
}
