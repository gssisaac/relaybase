import { invoke, isDesktopRuntime } from "./invoke";

export type OwnerSessionStatus = {
  hasRefresh: boolean;
  hasAccess: boolean;
  username: string;
  workerUrl: string;
  biometryEnabled: boolean;
  platform: string;
};

export type OwnerSetupResult = {
  username: string;
  passtoken: string;
};

/** Throws if the OS keyring cannot be read. Missing session is `hasRefresh: false`. */
export async function desktopOwnerSessionStatus(): Promise<OwnerSessionStatus> {
  if (!isDesktopRuntime()) {
    return {
      hasRefresh: false,
      hasAccess: false,
      username: "",
      workerUrl: "",
      biometryEnabled: true,
      platform: "other",
    };
  }
  return invoke("owner_session_status_cmd");
}

export async function desktopOwnerLogin(input: {
  workerUrl: string;
  username: string;
  passtoken: string;
  biometryEnabled?: boolean;
}): Promise<OwnerSessionStatus> {
  return invoke("owner_login_cmd", {
    workerUrl: input.workerUrl,
    username: input.username,
    passtoken: input.passtoken,
    biometryEnabled: input.biometryEnabled,
  });
}

export async function desktopOwnerUnlock(): Promise<OwnerSessionStatus> {
  return invoke("owner_unlock_cmd");
}

/** Touch ID / Windows Hello. Same invoke path as every other desktop command. */
export async function desktopOwnerTouchId(reason: string): Promise<void> {
  await invoke("owner_touch_id_cmd", { reason });
}

export async function desktopOwnerLogout(): Promise<void> {
  await invoke("owner_logout_cmd");
}

export async function desktopOwnerSetBiometryEnabled(
  enabled: boolean,
): Promise<OwnerSessionStatus> {
  return invoke("owner_set_biometry_enabled_cmd", { enabled });
}

export async function desktopOwnerSetupAdmin(input: {
  workerUrl: string;
  username: string;
  pepper: string;
}): Promise<OwnerSetupResult> {
  return invoke("owner_setup_admin_cmd", {
    workerUrl: input.workerUrl,
    username: input.username,
    pepper: input.pepper,
  });
}

export async function desktopOwnerResetAdmin(input: {
  workerUrl: string;
  cfAccessToken: string;
  username?: string;
}): Promise<OwnerSetupResult> {
  return invoke("owner_reset_admin_cmd", {
    workerUrl: input.workerUrl,
    cfAccessToken: input.cfAccessToken,
    username: input.username,
  });
}
