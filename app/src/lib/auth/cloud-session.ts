/**
 * Cloud account session (username + password → HQ Studio cookie + access JWT).
 * Re-exports the hq-auth client with cloud-centric naming.
 */
export {
  clearHqSession as clearCloudSession,
  getHqAccessToken as getCloudAccessToken,
  getHqUser as getCloudUser,
  hasHqSession as hasCloudSession,
  hqRefreshSession as cloudRefreshSession,
  subscribeHqAuth as subscribeCloudAuth,
} from "@/lib/hq-auth/session";

import { hqLogin, hqLogout } from "@/lib/hq-auth/session";
import { clearCloudWorkerSession, ensureCloudWorkerSession } from "@/lib/auth/cloud-worker-session";

export async function cloudLogin(input: {
  username: string;
  password: string;
}): Promise<void> {
  await hqLogin({ username: input.username.trim(), password: input.password });
  await ensureCloudWorkerSession();
}

export async function cloudLogout(): Promise<void> {
  clearCloudWorkerSession();
  await hqLogout();
}

export async function registerCloudAccount(input: {
  username: string;
  password: string;
  confirmPassword: string;
  installToken: string;
}): Promise<void> {
  const res = await fetch("/api/auth/register-cloud", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    accessToken?: string;
    expiresIn?: number;
    user?: unknown;
  };
  if (!res.ok) {
    throw new Error(body.error ?? `Signup failed (${res.status})`);
  }
  if (body.accessToken && body.user) {
    const { applyHqAuthPayload } = await import("@/lib/hq-auth/session");
    applyHqAuthPayload(body as {
      accessToken: string;
      expiresIn: number;
      user: import("@/lib/hq-auth/session").HqUser;
    });
    await ensureCloudWorkerSession();
  }
}

export async function resetCloudPasswordOAuth(input: {
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const res = await fetch("/api/auth/reset-password-oauth", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    accessToken?: string;
    expiresIn?: number;
    user?: import("@/lib/hq-auth/session").HqUser;
  };
  if (!res.ok) {
    throw new Error(body.error ?? `Reset failed (${res.status})`);
  }
  if (body.accessToken && body.user) {
    const { applyHqAuthPayload } = await import("@/lib/hq-auth/session");
    applyHqAuthPayload({
      accessToken: body.accessToken,
      expiresIn: body.expiresIn ?? 900,
      user: body.user,
    });
    await ensureCloudWorkerSession();
  }
}
