import type { InstallDecision } from "@/lib/desktop/bridge";

const DECISIONS_KEY = "rb_signup_install_decisions";
const WIPE_KEY = "rb_signup_wipe_confirmation";
const INSTALL_TOKEN_KEY = "rb_signup_install_token";
const CF_ACCOUNT_KEY = "rb_signup_cf_account_id";
const CF_ACCOUNT_NAME_KEY = "rb_signup_cf_account_name";
const EXISTING_USER_KEY = "rb_signup_existing_username";

export function saveSignupInstallPlan(opts: {
  decisions: InstallDecision[];
  wipeConfirmation?: string | null;
  cfAccountId: string;
  cfAccountName?: string;
}) {
  sessionStorage.setItem(DECISIONS_KEY, JSON.stringify(opts.decisions));
  if (opts.wipeConfirmation?.trim()) {
    sessionStorage.setItem(WIPE_KEY, opts.wipeConfirmation.trim());
  } else {
    sessionStorage.removeItem(WIPE_KEY);
  }
  sessionStorage.setItem(CF_ACCOUNT_KEY, opts.cfAccountId);
  if (opts.cfAccountName?.trim()) {
    sessionStorage.setItem(CF_ACCOUNT_NAME_KEY, opts.cfAccountName.trim());
  }
}

export function readSignupInstallPlan(): {
  decisions: InstallDecision[];
  wipeConfirmation: string | null;
  cfAccountId: string;
  cfAccountName: string;
} | null {
  const cfAccountId = sessionStorage.getItem(CF_ACCOUNT_KEY)?.trim();
  if (!cfAccountId) return null;
  let decisions: InstallDecision[] = [];
  try {
    decisions = JSON.parse(sessionStorage.getItem(DECISIONS_KEY) ?? "[]") as InstallDecision[];
  } catch {
    decisions = [];
  }
  return {
    decisions,
    wipeConfirmation: sessionStorage.getItem(WIPE_KEY),
    cfAccountId,
    cfAccountName: sessionStorage.getItem(CF_ACCOUNT_NAME_KEY)?.trim() || "",
  };
}

export function saveSignupInstallToken(
  installToken: string,
  cfAccountId: string,
  cfAccountName?: string,
) {
  sessionStorage.setItem(INSTALL_TOKEN_KEY, installToken);
  sessionStorage.setItem(CF_ACCOUNT_KEY, cfAccountId);
  if (cfAccountName?.trim()) {
    sessionStorage.setItem(CF_ACCOUNT_NAME_KEY, cfAccountName.trim());
  }
}

export function readSignupInstallToken(): {
  installToken: string;
  cfAccountId: string;
  cfAccountName: string;
} | null {
  const installToken = sessionStorage.getItem(INSTALL_TOKEN_KEY)?.trim();
  const cfAccountId = sessionStorage.getItem(CF_ACCOUNT_KEY)?.trim();
  if (!installToken || !cfAccountId) return null;
  return {
    installToken,
    cfAccountId,
    cfAccountName: sessionStorage.getItem(CF_ACCOUNT_NAME_KEY)?.trim() || "",
  };
}

export function saveExistingSignupUsername(username: string) {
  sessionStorage.setItem(EXISTING_USER_KEY, username);
}

export function readExistingSignupUsername(): string | null {
  return sessionStorage.getItem(EXISTING_USER_KEY)?.trim() || null;
}

export function clearSignupSession() {
  for (const key of [
    DECISIONS_KEY,
    WIPE_KEY,
    INSTALL_TOKEN_KEY,
    CF_ACCOUNT_KEY,
    CF_ACCOUNT_NAME_KEY,
    EXISTING_USER_KEY,
  ]) {
    sessionStorage.removeItem(key);
  }
}
