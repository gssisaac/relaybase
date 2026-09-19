import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { authStore } from "../../db/auth-store";
import type { HqAuthUser } from "../../db/auth-types";
import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import {
  verifyWorkerSignupProof,
  type WorkerSignupProof,
} from "./verify-worker-proof";
import { newId } from "../shared/ids";
import { hqAuthConfig, requireJwtSecret } from "./hq-auth-config";
import { signAccessToken } from "./jwt";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "./password";
import { hashOpaqueToken, newOpaqueToken } from "./token-hash";
import { encryptPasstoken } from "../vault/passtoken-vault";
import { normalizeUsername, validateUsername } from "./username";

export type PublicHqUser = {
  id: string;
  email: string;
  name: string | null;
  accountLinkId: string;
  username: string | null;
  cfAccountId: string | null;
  workerUrl: string | null;
};

function serializeUser(user: HqAuthUser): PublicHqUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountLinkId: user.accountLinkId,
    username: user.username ?? null,
    cfAccountId: user.cfAccountId ?? null,
    workerUrl: user.workerUrl ?? null,
  };
}

function clientMeta(c: Context): { userAgent: string | null; ip: string | null } {
  return {
    userAgent: c.req.header("user-agent") ?? null,
    ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

function refreshCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function setRefreshCookie(c: Context, refreshToken: string): void {
  const { refreshCookieName, refreshTtlSec } = hqAuthConfig();
  setCookie(c, refreshCookieName, refreshToken, refreshCookieOptions(refreshTtlSec));
}

export function clearRefreshCookie(c: Context): void {
  const { refreshCookieName } = hqAuthConfig();
  deleteCookie(c, refreshCookieName, { path: "/" });
}

export function readRefreshTokenFromCookie(c: Context): string | null {
  const { refreshCookieName } = hqAuthConfig();
  const raw = getCookie(c, refreshCookieName);
  return raw?.trim() || null;
}

export function issueAccessToken(user: HqAuthUser): { accessToken: string; expiresIn: number } {
  const secret = requireJwtSecret();
  const { accessTtlSec } = hqAuthConfig();
  const signed = signAccessToken(
    {
      sub: user.id,
      email: user.email,
      accountLinkId: user.accountLinkId,
      ...(user.username ? { username: user.username } : {}),
    },
    secret,
    accessTtlSec,
  );
  return { accessToken: signed.token, expiresIn: signed.expiresIn };
}

function persistRefreshToken(c: Context, userId: string): string {
  const { refreshTtlSec } = hqAuthConfig();
  const refreshToken = newOpaqueToken();
  const now = new Date();
  const meta = clientMeta(c);
  authStore.addRefreshToken({
    id: newId("rft"),
    tokenHash: hashOpaqueToken(refreshToken),
    userId,
    expiresAt: new Date(now.getTime() + refreshTtlSec * 1000).toISOString(),
    createdAt: now.toISOString(),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  return refreshToken;
}

/** Issue access JSON + Set-Cookie refresh (login, signup, successful refresh). */
export function issueAuthResponse(c: Context, user: HqAuthUser) {
  const access = issueAccessToken(user);
  const refreshToken = persistRefreshToken(c, user.id);
  setRefreshCookie(c, refreshToken);
  return {
    accessToken: access.accessToken,
    expiresIn: access.expiresIn,
    user: serializeUser(user),
  };
}

function linkWorkerUrlForNewAccount(workerUrl: string): void {
  const normalized = workerUrl.trim().replace(/\/$/, "");
  if (!normalized) return;
  store.update((draft) => {
    if (draft.account.id !== DEV_ACCOUNT_LINK_ID) return;
    draft.account.workerUrl = normalized;
  });
}

export async function signupUser(input: {
  email: string;
  password: string;
  confirmPassword?: string;
  name: string;
  workerUrl: string;
  workerProof: WorkerSignupProof;
}): Promise<{ ok: true; user: HqAuthUser } | { ok: false; error: string; status: number }> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Name is required.", status: 400 };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address.", status: 400 };
  }

  const policy = validatePasswordPolicy(input.password);
  if (policy) return { ok: false, error: policy, status: 400 };

  if (input.confirmPassword !== undefined && input.password !== input.confirmPassword) {
    return { ok: false, error: "Passwords do not match.", status: 400 };
  }

  if (authStore.findUserByEmail(email)) {
    return { ok: false, error: "An account with this email already exists.", status: 409 };
  }

  const verified = await verifyWorkerSignupProof(input.workerUrl, input.workerProof);
  if (!verified.ok) {
    return { ok: false, error: verified.error, status: 400 };
  }

  const now = new Date().toISOString();
  const user: HqAuthUser = {
    id: newId("usr"),
    email,
    passwordHash: hashPassword(input.password),
    name,
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    createdAt: now,
    updatedAt: now,
  };

  authStore.update((draft) => {
    draft.users.push(user);
  });

  linkWorkerUrlForNewAccount(input.workerUrl);

  return { ok: true, user };
}

export function loginUser(
  loginId: string,
  password: string,
): { ok: true; user: HqAuthUser } | { ok: false; error: string; status: number } {
  const trimmed = loginId.trim();
  const user =
    authStore.findUserByUsername(trimmed) ??
    authStore.findUserByEmail(trimmed.toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid username or password.", status: 401 };
  }
  return { ok: true, user };
}

export function isUsernameAvailable(username: string): boolean {
  const err = validateUsername(username);
  if (err) return false;
  return !authStore.findUserByUsername(normalizeUsername(username));
}

export function signupCloudUser(input: {
  username: string;
  password: string;
  confirmPassword?: string;
  cfAccountId: string;
  workerUrl: string;
  passtoken: string;
}): { ok: true; user: HqAuthUser } | { ok: false; error: string; status: number } {
  const usernameErr = validateUsername(input.username);
  if (usernameErr) return { ok: false, error: usernameErr, status: 400 };

  const username = normalizeUsername(input.username);
  if (authStore.findUserByUsername(username)) {
    return { ok: false, error: "That username is already taken.", status: 409 };
  }

  const cfAccountId = input.cfAccountId.trim().toLowerCase();
  if (!cfAccountId) {
    return { ok: false, error: "Cloudflare account id is required.", status: 400 };
  }
  if (authStore.findUserByCfAccountId(cfAccountId)) {
    return { ok: false, error: "This Cloudflare account is already registered.", status: 409 };
  }

  const workerUrl = input.workerUrl.trim().replace(/\/$/, "");
  if (!workerUrl || !/^https?:\/\//i.test(workerUrl)) {
    return { ok: false, error: "Enter a valid Worker URL.", status: 400 };
  }

  const policy = validatePasswordPolicy(input.password);
  if (policy) return { ok: false, error: policy, status: 400 };

  if (input.confirmPassword !== undefined && input.password !== input.confirmPassword) {
    return { ok: false, error: "Passwords do not match.", status: 400 };
  }

  const passtoken = input.passtoken.trim();
  if (!passtoken) {
    return { ok: false, error: "Passtoken provisioning failed.", status: 400 };
  }

  let passtokenEnc: string;
  try {
    passtokenEnc = encryptPasstoken(passtoken);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not store credentials.",
      status: 503,
    };
  }

  const now = new Date().toISOString();
  const user: HqAuthUser = {
    id: newId("usr"),
    email: `${username}@users.relaybase`,
    passwordHash: hashPassword(input.password),
    name: username,
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    username,
    cfAccountId,
    workerUrl,
    passtokenEnc,
    createdAt: now,
    updatedAt: now,
  };

  authStore.update((draft) => {
    draft.users.push(user);
  });

  linkWorkerUrlForNewAccount(workerUrl);

  return { ok: true, user };
}

export function resetPasswordForCfAccount(
  cfAccountId: string,
  newPassword: string,
  confirmPassword?: string,
): { ok: true; user: HqAuthUser } | { ok: false; error: string; status: number } {
  const policy = validatePasswordPolicy(newPassword);
  if (policy) return { ok: false, error: policy, status: 400 };
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return { ok: false, error: "Passwords do not match.", status: 400 };
  }

  const user = authStore.findUserByCfAccountId(cfAccountId.trim());
  if (!user) {
    return { ok: false, error: "No Relaybase account is linked to this Cloudflare account.", status: 404 };
  }

  const passwordHash = hashPassword(newPassword);
  const updatedAt = new Date().toISOString();

  authStore.update((draft) => {
    const row = draft.users.find((u) => u.id === user.id);
    if (row) {
      row.passwordHash = passwordHash;
      row.updatedAt = updatedAt;
    }
    draft.refreshTokens = draft.refreshTokens.filter((t) => t.userId !== user.id);
  });

  return {
    ok: true,
    user: { ...user, passwordHash, updatedAt },
  };
}

export function refreshFromCookie(
  c: Context,
):
  | { ok: true; user: HqAuthUser; revokeRecordId: string; newRefreshToken: string }
  | { ok: false; status: number } {
  const raw = readRefreshTokenFromCookie(c);
  if (!raw) return { ok: false, status: 401 };

  const record = authStore.findRefreshTokenByHash(hashOpaqueToken(raw));
  if (!record) return { ok: false, status: 401 };
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    authStore.revokeRefreshTokenById(record.id);
    return { ok: false, status: 401 };
  }

  const user = authStore.findUserById(record.userId);
  if (!user) {
    authStore.revokeRefreshTokenById(record.id);
    return { ok: false, status: 401 };
  }

  authStore.revokeRefreshTokenById(record.id);
  const newRefreshToken = persistRefreshToken(c, user.id);
  return { ok: true, user, revokeRecordId: record.id, newRefreshToken };
}

export function logoutFromCookie(c: Context): void {
  const raw = readRefreshTokenFromCookie(c);
  if (raw) {
    const record = authStore.findRefreshTokenByHash(hashOpaqueToken(raw));
    if (record) authStore.revokeRefreshTokenById(record.id);
  }
  clearRefreshCookie(c);
}

export function requestPasswordReset(email: string): void {
  const user = authStore.findUserByEmail(email);
  if (!user) return;

  const token = newOpaqueToken();
  const now = new Date();
  const { resetTtlSec, appBaseUrl } = hqAuthConfig();

  authStore.addPasswordResetToken({
    id: newId("prt"),
    tokenHash: hashOpaqueToken(token),
    userId: user.id,
    expiresAt: new Date(now.getTime() + resetTtlSec * 1000).toISOString(),
    createdAt: now.toISOString(),
    used: false,
  });

  const resetUrl = `${appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[hq-auth] password reset link for ${user.email}: ${resetUrl}`);
  }
}

export function updateUserProfile(
  userId: string,
  name: string,
): { ok: true; user: HqAuthUser } | { ok: false; error: string; status: number } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Name is required.", status: 400 };
  }

  const existing = authStore.findUserById(userId);
  if (!existing) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const updatedAt = new Date().toISOString();
  authStore.update((draft) => {
    const row = draft.users.find((u) => u.id === userId);
    if (row) {
      row.name = trimmed;
      row.updatedAt = updatedAt;
    }
  });

  return {
    ok: true,
    user: { ...existing, name: trimmed, updatedAt },
  };
}

export function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): { ok: true; user: HqAuthUser } | { ok: false; error: string; status: number } {
  const policy = validatePasswordPolicy(newPassword);
  if (policy) return { ok: false, error: policy, status: 400 };

  const user = authStore.findUserById(userId);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return { ok: false, error: "Current password is incorrect.", status: 401 };
  }

  const passwordHash = hashPassword(newPassword);
  const updatedAt = new Date().toISOString();

  authStore.update((draft) => {
    const row = draft.users.find((u) => u.id === userId);
    if (row) {
      row.passwordHash = passwordHash;
      row.updatedAt = updatedAt;
    }
    draft.refreshTokens = draft.refreshTokens.filter((t) => t.userId !== userId);
  });

  return {
    ok: true,
    user: { ...user, passwordHash, updatedAt },
  };
}

export function resetPasswordWithToken(
  token: string,
  newPassword: string,
): { ok: true; user: HqAuthUser } | { ok: false; error: string; status: number } {
  const policy = validatePasswordPolicy(newPassword);
  if (policy) return { ok: false, error: policy, status: 400 };

  const tokenHash = hashOpaqueToken(token.trim());
  const record = authStore.findPasswordResetByHash(tokenHash);
  if (!record || record.used || new Date(record.expiresAt).getTime() <= Date.now()) {
    return { ok: false, error: "Invalid or expired reset link.", status: 400 };
  }

  const user = authStore.findUserById(record.userId);
  if (!user) {
    return { ok: false, error: "Invalid or expired reset link.", status: 400 };
  }

  const passwordHash = hashPassword(newPassword);
  const updatedAt = new Date().toISOString();

  authStore.update((draft) => {
    const u = draft.users.find((row) => row.id === user.id);
    if (u) {
      u.passwordHash = passwordHash;
      u.updatedAt = updatedAt;
    }
    for (const row of draft.passwordResetTokens) {
      if (row.id === record.id) row.used = true;
    }
    draft.refreshTokens = draft.refreshTokens.filter((t) => t.userId !== user.id);
  });

  return {
    ok: true,
    user: { ...user, passwordHash, updatedAt },
  };
}

export { serializeUser };
