import { Hono } from "hono";

import { authStore } from "../db/auth-store";
import { requireJwtSecret } from "../lib/auth/hq-auth-config";
import {
  changeUserPassword,
  issueAccessToken,
  issueAuthResponse,
  loginUser,
  logoutFromCookie,
  refreshFromCookie,
  requestPasswordReset,
  resetPasswordWithToken,
  resetPasswordForCfAccount,
  serializeUser,
  setRefreshCookie,
  signupUser,
  signupCloudUser,
  isUsernameAvailable,
  updateUserProfile,
} from "../lib/auth/hq-auth-service";
import { verifyInternalAuthHeader } from "../lib/auth/internal-auth";
import {
  generateAvailableUsername,
  validateUsername,
} from "../lib/auth/username";
import { verifyAccessToken } from "../lib/auth/jwt";
import { bearerToken } from "../lib/auth/bearer-token";
import { mintWorkerOwnerSession } from "../lib/auth/worker-owner-session";

export const hqAuth = new Hono();

hqAuth.post("/signup", async (c) => {
  try {
    requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  let body: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    name?: string;
    workerUrl?: string;
    workerProof?: {
      kind?: string;
      passtoken?: string;
      accountEmail?: string;
      teamPassword?: string;
    };
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const proofKind = body.workerProof?.kind === "team" ? "team" : "owner";
  const workerProof =
    proofKind === "team"
      ? {
          kind: "team" as const,
          accountEmail: body.workerProof?.accountEmail ?? "",
          teamPassword: body.workerProof?.teamPassword ?? "",
        }
      : {
          kind: "owner" as const,
          passtoken: body.workerProof?.passtoken ?? "",
        };

  const result = await signupUser({
    email: body.email ?? "",
    password: body.password ?? "",
    confirmPassword: body.confirmPassword,
    name: body.name ?? "",
    workerUrl: body.workerUrl ?? "",
    workerProof,
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 400 | 409);
  }

  return c.json(issueAuthResponse(c, result.user));
});

hqAuth.post("/login", async (c) => {
  try {
    requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  let body: { email?: string; username?: string; password?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const loginId = body.username ?? body.email ?? "";
  const result = loginUser(loginId, body.password ?? "");
  if (!result.ok) {
    return c.json({ error: result.error }, 401);
  }

  return c.json(issueAuthResponse(c, result.user));
});

hqAuth.post("/refresh", async (c) => {
  try {
    requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  const refreshed = refreshFromCookie(c);
  if (!refreshed.ok) {
    logoutFromCookie(c);
    return c.json({ error: "Session expired. Sign in again." }, 401);
  }

  setRefreshCookie(c, refreshed.newRefreshToken);
  const access = issueAccessToken(refreshed.user);
  return c.json({
    accessToken: access.accessToken,
    expiresIn: access.expiresIn,
    user: serializeUser(refreshed.user),
  });
});

hqAuth.post("/logout", async (c) => {
  logoutFromCookie(c);
  return c.json({ ok: true });
});

function authenticatedUser(c: { req: { header: (name: string) => string | undefined } }) {
  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Auth unavailable",
      status: 503 as const,
      user: null,
    };
  }

  const token = bearerToken(c);
  if (!token) return { error: "Unauthorized", status: 401 as const, user: null };

  const claims = verifyAccessToken(token, secret);
  if (!claims) return { error: "Unauthorized", status: 401 as const, user: null };

  const user = authStore.findUserById(claims.sub);
  if (!user) return { error: "Unauthorized", status: 401 as const, user: null };

  return { error: null, status: null, user };
}

hqAuth.get("/me", async (c) => {
  const auth = authenticatedUser(c);
  if (!auth.user) {
    return c.json({ error: auth.error ?? "Unauthorized" }, auth.status ?? 401);
  }

  return c.json({ user: serializeUser(auth.user) });
});

hqAuth.patch("/me", async (c) => {
  const auth = authenticatedUser(c);
  if (!auth.user) {
    return c.json({ error: auth.error ?? "Unauthorized" }, auth.status ?? 401);
  }

  let body: { name?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = updateUserProfile(auth.user.id, body.name ?? "");
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 400 | 401);
  }

  return c.json({ user: serializeUser(result.user) });
});

hqAuth.post("/worker-session", async (c) => {
  const auth = authenticatedUser(c);
  if (!auth.user) {
    return c.json({ error: auth.error ?? "Unauthorized" }, auth.status ?? 401);
  }

  const minted = await mintWorkerOwnerSession(auth.user);
  if (!minted.ok) {
    return c.json({ error: minted.error }, minted.status as 404 | 502 | 503);
  }

  return c.json(minted.session);
});

hqAuth.post("/change-password", async (c) => {
  const auth = authenticatedUser(c);
  if (!auth.user) {
    return c.json({ error: auth.error ?? "Unauthorized" }, auth.status ?? 401);
  }

  let body: { currentPassword?: string; newPassword?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = changeUserPassword(
    auth.user.id,
    body.currentPassword ?? "",
    body.newPassword ?? "",
  );
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 400 | 401);
  }

  return c.json({ ok: true });
});

/** Internal — cloud signup checks whether this CF account already has a Relaybase user. */
hqAuth.get("/cloud-account-lookup", async (c) => {
  if (!verifyInternalAuthHeader(c.req.header("x-relaybase-internal-auth"))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const cfAccountId = c.req.query("cfAccountId") ?? "";
  if (!cfAccountId.trim()) {
    return c.json({ error: "cfAccountId is required" }, 400);
  }
  const user = authStore.findUserByCfAccountId(cfAccountId);
  if (!user) {
    return c.json({ exists: false });
  }
  return c.json({ exists: true, username: user.username ?? user.email ?? "" });
});

hqAuth.get("/check-username", async (c) => {
  const username = c.req.query("username") ?? "";
  if (!username.trim()) {
    return c.json({ available: false, reason: "invalid", error: "Username is required." }, 400);
  }
  const validationErr = validateUsername(username);
  if (validationErr) {
    return c.json({ available: false, reason: "invalid", error: validationErr });
  }
  const available = isUsernameAvailable(username);
  return c.json({
    available,
    reason: available ? undefined : "taken",
  });
});

hqAuth.get("/suggest-username", async (c) => {
  const cfAccountId = c.req.query("cfAccountId") ?? "";
  const cfAccountName = c.req.query("cfAccountName") ?? "";
  const baseInput = cfAccountName.trim() || cfAccountId.trim();
  if (!baseInput) {
    return c.json({ error: "cfAccountId is required" }, 400);
  }
  const username = generateAvailableUsername(baseInput, isUsernameAvailable);
  return c.json({ username });
});

/** Cloud signup — passtoken is provisioned server-side only (internal auth header). */
hqAuth.post("/signup/cloud", async (c) => {
  if (!verifyInternalAuthHeader(c.req.header("x-relaybase-internal-auth"))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  try {
    requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  let body: {
    username?: string;
    password?: string;
    confirmPassword?: string;
    cfAccountId?: string;
    workerUrl?: string;
    passtoken?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = signupCloudUser({
    username: body.username ?? "",
    password: body.password ?? "",
    confirmPassword: body.confirmPassword,
    cfAccountId: body.cfAccountId ?? "",
    workerUrl: body.workerUrl ?? "",
    passtoken: body.passtoken ?? "",
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 400 | 409 | 503);
  }

  return c.json(issueAuthResponse(c, result.user));
});

hqAuth.post("/reset-password/oauth", async (c) => {
  if (!verifyInternalAuthHeader(c.req.header("x-relaybase-internal-auth"))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  try {
    requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  let body: {
    cfAccountId?: string;
    newPassword?: string;
    confirmPassword?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = resetPasswordForCfAccount(
    body.cfAccountId ?? "",
    body.newPassword ?? "",
    body.confirmPassword,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 400 | 404);
  }

  return c.json(issueAuthResponse(c, result.user));
});

hqAuth.post("/forgot-password", async (c) => {
  let body: { email?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  requestPasswordReset(body.email ?? "");
  return c.json({
    ok: true,
    message: "If an account exists for that email, a reset link was sent.",
  });
});

hqAuth.post("/reset-password", async (c) => {
  try {
    requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  let body: { token?: string; newPassword?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = resetPasswordWithToken(body.token ?? "", body.newPassword ?? "");
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(issueAuthResponse(c, result.user));
});
