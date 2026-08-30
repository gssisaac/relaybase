import { invoke, isDesktopRuntime } from "./invoke";

export type OwnerSessionStatus = {
  hasMailRefresh: boolean;
  hasConsoleRefresh: boolean;
  hasMailAccess: boolean;
  hasConsoleAccess: boolean;
  /** Back-compat shims from Rust. */
  hasRefresh: boolean;
  hasAccess: boolean;
  /** OS keyring `owner-passtoken` exists (secret is never returned). */
  hasPasstoken: boolean;
  username: string;
  workerUrl: string;
  platform: string;
};

export type OwnerSetupResult = {
  username: string;
  passtoken: string;
};

const EMPTY_OWNER: OwnerSessionStatus = {
  hasMailRefresh: false,
  hasConsoleRefresh: false,
  hasMailAccess: false,
  hasConsoleAccess: false,
  hasRefresh: false,
  hasAccess: false,
  hasPasstoken: false,
  username: "",
  workerUrl: "",
  platform: "other",
};

/** Throws if the OS keyring cannot be read. Missing session is `hasRefresh: false`. */
export async function desktopOwnerSessionStatus(): Promise<OwnerSessionStatus> {
  if (!isDesktopRuntime()) {
    return { ...EMPTY_OWNER };
  }
  return invoke("owner_session_status_cmd");
}

export async function desktopOwnerLogin(input: {
  workerUrl: string;
  username: string;
  passtoken: string;
}): Promise<OwnerSessionStatus> {
  return invoke("owner_login_cmd", {
    workerUrl: input.workerUrl,
    username: input.username,
    passtoken: input.passtoken,
  });
}

export async function desktopOwnerBootMail(): Promise<OwnerSessionStatus> {
  return invoke("owner_boot_mail_cmd");
}

export async function desktopOwnerUnlockConsole(): Promise<OwnerSessionStatus> {
  return invoke("owner_unlock_console_cmd");
}

/** Touch ID / Windows Hello — console gate only. */
export async function desktopOwnerTouchId(reason: string): Promise<void> {
  await invoke("owner_touch_id_cmd", { reason });
}

/** Touch ID then read keyring passtoken and login. Secret never returns to JS. */
export async function desktopOwnerLoginFromKeyring(
  reason: string,
): Promise<OwnerSessionStatus> {
  return invoke("owner_login_from_keyring_cmd", { reason });
}

export async function desktopOwnerLogout(): Promise<void> {
  await invoke("owner_logout_cmd");
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
