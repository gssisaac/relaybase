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
  CONSOLE_ACCESS_TTL_SECONDS,
  CONSOLE_REFRESH_TTL_SECONDS,
  generatePasstoken,
  generateRefreshToken,
  hashPasstoken,
  isValidPasstokenFormat,
  MAIL_ACCESS_TTL_SECONDS,
  MAIL_REFRESH_TTL_SECONDS,
  passtokenPrefix,
  randomSalt,
  scopeFromSessionLabel,
  sessionLabelForScope,
  signAccessToken,
  type AccessPayload,
  type OwnerScope,
} from "./owner-tokens";

export {
  ACCESS_TTL_SECONDS,
  CONSOLE_ACCESS_TTL_SECONDS,
  CONSOLE_REFRESH_TTL_SECONDS,
  MAIL_ACCESS_TTL_SECONDS,
  MAIL_REFRESH_TTL_SECONDS,
  generatePasstoken,
  passtokenPrefix,
  isValidPasstokenFormat,
  signAccessToken,
  verifyAccessToken,
} from "./owner-tokens";
export type { AccessPayload, OwnerScope } from "./owner-tokens";

/** HTTP status codes returned by owner-auth helpers. */
type AuthStatus = 400 | 401 | 403 | 409 | 429 | 503;
type AuthError = { error: string; status: AuthStatus };

const LOGIN_LOCK_SECONDS = 5 * 60;
const MAX_FAILED_ATTEMPTS = 5;

export type OwnerRefreshResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: OwnerScope;
};

/** Passtoken login — mail access immediately; console refresh for later gate. */
export type OwnerLoginResult = {
  mailAccessToken: string;
  mailRefreshToken: string;
  consoleRefreshToken: string;
  mailExpiresIn: number;
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

function accessTtlForScope(scope: OwnerScope): number {
  return scope === "mail" ? MAIL_ACCESS_TTL_SECONDS : CONSOLE_ACCESS_TTL_SECONDS;
}

function refreshTtlForScope(scope: OwnerScope): number {
  return scope === "mail" ? MAIL_REFRESH_TTL_SECONDS : CONSOLE_REFRESH_TTL_SECONDS;
}

async function mintScopedAccess(
  pepper: string,
  username: string,
  scope: OwnerScope,
): Promise<{ accessToken: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = accessTtlForScope(scope);
  const accessPayload: AccessPayload = {
    sub: username,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID(),
    scope,
  };
  const accessToken = await signAccessToken(pepper, accessPayload);
  return { accessToken, expiresIn };
}

async function createScopedRefreshSession(
  db: NonNullable<ReturnType<typeof createAppDb>>,
  scope: OwnerScope,
  label: string | null,
): Promise<string> {
  const refreshToken = generateRefreshToken();
  const refreshHash = await sha256Hex(refreshToken);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + refreshTtlForScope(scope) * 1000,
  ).toISOString();
  const deviceLabel = label?.trim() || "desktop";
  await createOwnerSession(db, {
    id: crypto.randomUUID(),
    tokenHash: refreshHash,
    family: crypto.randomUUID(),
    label: sessionLabelForScope(scope, deviceLabel),
    expiresAt,
  });
  return refreshToken;
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
): Promise<{ result: OwnerLoginResult } | AuthError> {
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

  const mailRefreshToken = await createScopedRefreshSession(
    db,
    "mail",
    input.label ?? null,
  );
  const consoleRefreshToken = await createScopedRefreshSession(
    db,
    "console",
    input.label ?? null,
  );
  const { accessToken: mailAccessToken, expiresIn: mailExpiresIn } =
    await mintScopedAccess(pepper, cfg.adminUsername, "mail");

  return {
    result: {
      mailAccessToken,
      mailRefreshToken,
      consoleRefreshToken,
      mailExpiresIn,
    },
  };
}

// ─── refresh ──────────────────────────────────────────────────────────────

export async function refreshOwner(
  env: Env,
  refreshToken: string,
  scope: OwnerScope,
): Promise<{ result: OwnerRefreshResult } | AuthError> {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepper = env.AUTH_PEPPER?.trim() ?? "";

  const hash = await sha256Hex(refreshToken.trim());
  const session = await findOwnerSessionByHash(db, hash);
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }
  const sessionScope = scopeFromSessionLabel(session.label);
  if (sessionScope !== null && sessionScope !== scope) {
    return { error: "Unauthorized", status: 401 };
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await deleteOwnerSession(db, session.id);
    return { error: "Unauthorized", status: 401 };
  }

  await deleteOwnerSession(db, session.id);

  const cfg = await getOwnerLoginConfig(db);
  if (!cfg?.adminUsername) {
    return { error: "Unauthorized", status: 401 };
  }

  const newRefresh = generateRefreshToken();
  const newHash = await sha256Hex(newRefresh);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + refreshTtlForScope(scope) * 1000,
  ).toISOString();
  const label =
    sessionScope !== null
      ? session.label
      : sessionLabelForScope(scope, session.label ?? "desktop");
  await createOwnerSession(db, {
    id: crypto.randomUUID(),
    tokenHash: newHash,
    family: session.family,
    label,
    expiresAt,
  });

  const { accessToken, expiresIn } = await mintScopedAccess(
    pepper,
    cfg.adminUsername,
    scope,
  );

  return {
    result: {
      accessToken,
      refreshToken: newRefresh,
      expiresIn,
      scope,
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
