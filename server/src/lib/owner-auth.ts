import type { Env } from "../env";
import { createAppDb } from "../../db/app";
import {
  createOwnerSession,
  deleteAllOwnerSessions,
  deleteOwnerSession,
  deleteOwnerSessionByHash,
  deleteOwnerSessionsByFamily,
  findOwnerSessionByHash,
} from "../../db/app/owner-sessions";
import {
  getOwnerLoginConfig,
  incrementFailedLogin,
  ownerIsConfigured,
  resetFailedLogin,
  setOwnerLogin,
} from "../../db/app/owner";
import { sha256Hex } from "./crypto";
import {
  ACCESS_TTL_SECONDS,
  generatePasstoken,
  generateRefreshToken,
  hashPasstoken,
  isValidPasstokenFormat,
  passtokenPrefix,
  randomSalt,
  signAccessToken,
  type AccessPayload,
} from "./owner-tokens";

export { ACCESS_TTL_SECONDS, generatePasstoken, passtokenPrefix, isValidPasstokenFormat, signAccessToken, verifyAccessToken } from "./owner-tokens";
export type { AccessPayload } from "./owner-tokens";

/** HTTP status codes returned by owner-auth helpers. */
type AuthStatus = 400 | 401 | 403 | 409 | 429 | 503;
type AuthError = { error: string; status: AuthStatus };

const REFRESH_TTL_DAYS = 14;
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;
const LOGIN_LOCK_SECONDS = 5 * 60;
const MAX_FAILED_ATTEMPTS = 5;

export type OwnerAuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().slice(0, 64);
}

function usernameEquals(a: string, b: string): boolean {
  const na = normalizeUsername(a);
  const nb = normalizeUsername(b);
  if (na.length !== nb.length) return false;
  let diff = 0;
  for (let i = 0; i < na.length; i++) diff |= na.charCodeAt(i) ^ nb.charCodeAt(i);
  return diff === 0;
}

// ─── setup-admin (first owner) ────────────────────────────────────────────

export type SetupAdminInput = {
  username: string;
  pepper: string;
};

export type SetupAdminResult = {
  passtoken: string;
  username: string;
};

/** Issues the first owner passtoken. Only allowed when no owner exists yet. */
export async function setupOwner(
  env: Env,
  input: SetupAdminInput,
): Promise<{ result: SetupAdminResult } | AuthError> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };

  const pepper = env.AUTH_PEPPER?.trim() ?? "";
  if (!pepper || pepper !== input.pepper.trim()) {
    return { error: "Unauthorized", status: 401 };
  }

  if (await ownerIsConfigured(db)) {
    return { error: "Owner already configured", status: 409 };
  }

  const username = normalizeUsername(input.username);
  if (username.length < 3) {
    return { error: "Username must be at least 3 characters", status: 400 };
  }

  const salt = randomSalt();
  const passtoken = generatePasstoken();
  const hash = await hashPasstoken(pepper, salt, passtoken);
  await setOwnerLogin(db, {
    adminUsername: username,
    passtokenSalt: salt,
    passtokenHash: hash,
    passtokenPrefix: passtokenPrefix(passtoken),
  });
  return { result: { passtoken, username } };
}

// ─── login ────────────────────────────────────────────────────────────────

export async function loginOwner(
  env: Env,
  input: { username: string; passtoken: string; label?: string | null },
): Promise<{ result: OwnerAuthResult } | AuthError> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepper = env.AUTH_PEPPER?.trim() ?? "";

  const cfg = await getOwnerLoginConfig(db);
  if (!cfg || !cfg.adminUsername || !cfg.passtokenHash || !cfg.passtokenSalt) {
    return { error: "Invalid credentials", status: 401 };
  }

  if (cfg.lockedUntil) {
    const lockedUntilMs = Date.parse(cfg.lockedUntil);
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
      return { error: "Too many attempts. Try again later.", status: 429 };
    }
  }

  const usernameOk = usernameEquals(input.username, cfg.adminUsername);
  const passtokenOk =
    isValidPasstokenFormat(input.passtoken) &&
    (await hashPasstoken(pepper, cfg.passtokenSalt, input.passtoken)) ===
      cfg.passtokenHash;

  if (!usernameOk || !passtokenOk) {
    const { failedAttempts } = await incrementFailedLogin(db, LOGIN_LOCK_SECONDS);
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return { error: "Too many attempts. Try again later.", status: 429 };
    }
    return { error: "Invalid credentials", status: 401 };
  }

  await resetFailedLogin(db);

  const family = crypto.randomUUID();
  const refreshToken = generateRefreshToken();
  const refreshHash = await sha256Hex(refreshToken);
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000).toISOString();
  await createOwnerSession(db, {
    id: sessionId,
    tokenHash: refreshHash,
    family,
    label: input.label?.trim() || null,
    expiresAt,
  });

  const accessPayload: AccessPayload = {
    sub: cfg.adminUsername,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(now.getTime() / 1000) + ACCESS_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };
  const accessToken = await signAccessToken(pepper, accessPayload);

  return {
    result: {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
    },
  };
}

// ─── refresh ──────────────────────────────────────────────────────────────

export async function refreshOwner(
  env: Env,
  refreshToken: string,
): Promise<{ result: OwnerAuthResult } | AuthError> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepper = env.AUTH_PEPPER?.trim() ?? "";

  const hash = await sha256Hex(refreshToken.trim());
  const session = await findOwnerSessionByHash(db, hash);
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await deleteOwnerSession(db, session.id);
    return { error: "Unauthorized", status: 401 };
  }

  // Rotate: delete the presented refresh, issue a new one in the same family.
  await deleteOwnerSession(db, session.id);

  const cfg = await getOwnerLoginConfig(db);
  if (!cfg?.adminUsername) {
    return { error: "Unauthorized", status: 401 };
  }

  const newRefresh = generateRefreshToken();
  const newHash = await sha256Hex(newRefresh);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000).toISOString();
  await createOwnerSession(db, {
    id: crypto.randomUUID(),
    tokenHash: newHash,
    family: session.family,
    label: session.label,
    expiresAt,
  });

  const accessPayload: AccessPayload = {
    sub: cfg.adminUsername,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(now.getTime() / 1000) + ACCESS_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };
  const accessToken = await signAccessToken(pepper, accessPayload);

  return {
    result: {
      accessToken,
      refreshToken: newRefresh,
      expiresIn: ACCESS_TTL_SECONDS,
    },
  };
}

/** Revoke the family that owns a refresh token (reuse / explicit revoke). */
export async function revokeOwnerFamilyByRefresh(
  env: Env,
  refreshToken: string,
): Promise<void> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return;
  const hash = await sha256Hex(refreshToken.trim());
  const session = await findOwnerSessionByHash(db, hash);
  if (session) await deleteOwnerSessionsByFamily(db, session.family);
}

// ─── logout ───────────────────────────────────────────────────────────────

export async function logoutOwner(env: Env, refreshToken: string): Promise<void> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return;
  const hash = await sha256Hex(refreshToken.trim());
  await deleteOwnerSessionByHash(db, hash);
}

// ─── rotate passtoken (logged-in owner) ───────────────────────────────────

export async function rotatePasstoken(
  env: Env,
): Promise<{ passtoken: string; username: string } | AuthError> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepper = env.AUTH_PEPPER?.trim() ?? "";
  const cfg = await getOwnerLoginConfig(db);
  if (!cfg?.adminUsername) return { error: "Unauthorized", status: 401 };

  const salt = randomSalt();
  const passtoken = generatePasstoken();
  const hash = await hashPasstoken(pepper, salt, passtoken);
  await setOwnerLogin(db, {
    adminUsername: cfg.adminUsername,
    passtokenSalt: salt,
    passtokenHash: hash,
    passtokenPrefix: passtokenPrefix(passtoken),
  });
  // Invalidate every existing session — other devices must log in again.
  await deleteAllOwnerSessions(db);
  return { passtoken, username: cfg.adminUsername };
}

// ─── reset-admin (forgot passtoken, CF OAuth proof) ─────────────────────

export async function resetOwner(
  env: Env,
  input: { cfAccessToken: string; username?: string },
): Promise<{ passtoken: string; username: string } | AuthError> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepper = env.AUTH_PEPPER?.trim() ?? "";
  const expectedAccount = env.CF_ACCOUNT_ID?.trim() ?? "";

  const verified = await verifyCfTokenAccount(input.cfAccessToken);
  if (!verified.ok) return { error: "Unauthorized", status: 401 };
  if (!expectedAccount || verified.accountId !== expectedAccount) {
    return { error: "Unauthorized", status: 401 };
  }

  const cfg = await getOwnerLoginConfig(db);
  const username = normalizeUsername(input.username ?? cfg?.adminUsername ?? "");
  if (username.length < 3) {
    return { error: "Username must be at least 3 characters", status: 400 };
  }

  const salt = randomSalt();
  const passtoken = generatePasstoken();
  const hash = await hashPasstoken(pepper, salt, passtoken);
  await setOwnerLogin(db, {
    adminUsername: username,
    passtokenSalt: salt,
    passtokenHash: hash,
    passtokenPrefix: passtokenPrefix(passtoken),
  });
  await deleteAllOwnerSessions(db);
  return { passtoken, username };
}

async function verifyCfTokenAccount(
  token: string,
): Promise<{ ok: boolean; accountId?: string }> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    const data = (await res.json()) as {
      success?: boolean;
      result?: { id?: string; status?: string };
    };
    if (!data.success || data.result?.status !== "active") {
      return { ok: false };
    }
    const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    const accData = (await accRes.json()) as {
      success?: boolean;
      result?: Array<{ id: string }>;
    };
    if (!accData.success || !accData.result?.length) return { ok: false };
    const accountId = accData.result[0].id;
    return { ok: true, accountId };
  } catch {
    return { ok: false };
  }
}
