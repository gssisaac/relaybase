import { Hono } from "hono";

import { authStore } from "../db/auth-store";
import { requireJwtSecret } from "../lib/auth/hq-auth-config";
import {
  issueAccessToken,
  issueAuthResponse,
  loginUser,
  logoutFromCookie,
  refreshFromCookie,
  requestPasswordReset,
  resetPasswordWithToken,
  serializeUser,
  setRefreshCookie,
  signupUser,
} from "../lib/auth/hq-auth-service";
import { verifyAccessToken } from "../lib/auth/jwt";
import { bearerToken } from "../lib/auth/bearer-token";

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

  let body: { email?: string; password?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = loginUser(body.email ?? "", body.password ?? "");
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

hqAuth.get("/me", async (c) => {
  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Auth unavailable" }, 503);
  }

  const token = bearerToken(c);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const claims = verifyAccessToken(token, secret);
  if (!claims) return c.json({ error: "Unauthorized" }, 401);

  const user = authStore.findUserById(claims.sub);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  return c.json({ user: serializeUser(user) });
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
