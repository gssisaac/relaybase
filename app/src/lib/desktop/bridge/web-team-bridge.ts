import {
  getWebTeamAuth,
  setWebTeamAuth,
} from "@/mail-platform/session/email-session";
import type { TeamSessionStatus } from "./team";

const EMPTY_TEAM: TeamSessionStatus = {
  hasSecret: false,
  hasAccess: false,
  accountEmail: "",
  workerUrl: "",
  platform: "other",
};

export function webTeamSessionStatus(): TeamSessionStatus {
  const auth = getWebTeamAuth();
  if (!auth?.workerUrl?.trim()) return { ...EMPTY_TEAM };
  return {
    hasSecret: true,
    hasAccess: true,
    accountEmail: auth.accountEmail,
    workerUrl: auth.workerUrl.trim().replace(/\/$/, ""),
    platform: "other",
  };
}

export async function webTeamLogin(input: {
  workerUrl: string;
  accountEmail: string;
  mobilePassword: string;
}): Promise<TeamSessionStatus> {
  const workerUrl = input.workerUrl.trim().replace(/\/$/, "");
  const accountEmail = input.accountEmail.trim().toLowerCase();
  const password = input.mobilePassword;
  if (!workerUrl || !accountEmail || !password) {
    throw new Error("Worker URL, account email, and password are required.");
  }

  const res = await fetch(`${workerUrl}/mobile/config`, {
    headers: {
      Authorization: `Bearer ${password}`,
      "X-Account-Email": accountEmail,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Sign in failed. Check your password.");
  }

  setWebTeamAuth({ workerUrl, accountEmail, mobilePassword: password });
  return webTeamSessionStatus();
}

export async function webTeamUnlock(): Promise<TeamSessionStatus> {
  const status = webTeamSessionStatus();
  if (!status.hasAccess) {
    throw new Error("No saved team session.");
  }
  return status;
}

export function webTeamLogout(): void {
  setWebTeamAuth(null);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("relaybase:email-session");
    } catch {
      /* private mode */
    }
  }
}
