import {
  consumeRecoveryToken,
  createAccount,
  createRecoveryToken,
  createSession,
  getAccountById,
  isValidEmail,
  registerWorker,
  setAccountPassword,
  verifyAccountCredentials,
} from "@/lib/accounts";
import {
  assertEnv,
  clearSessionCookieHeader,
  getEnv,
  setSessionCookieHeader,
  verifyRequestSession,
} from "@/lib/env";

export const runtime = "edge";

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

async function readJson<T = unknown>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}

async function sessionFromReq(
  req: Request,
  secret: string,
) {
  return verifyRequestSession(req, secret);
}

export async function POST(req: Request) {
  const env = await getEnv();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  try {
    switch (action) {
      case "signup":
        return await handleSignup(req, env);
      case "login":
        return await handleLogin(req, env);
      case "recover":
        return await handleRecover(req, env);
      case "reset-password":
        return await handleResetPassword(req, env);
      case "worker/register":
        return await handleWorkerRegister(req, env);
      case "recovery-token":
        return await handleRecoveryToken(req, env);
      case "logout":
        return handleLogout();
      default:
        return json({ error: "Unknown account action" }, 404);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return json({ error: message }, 400);
  }
}

export async function GET(req: Request) {
  const env = await getEnv();
  try {
    const secret = assertEnv(env, "CONSOLE_SESSION_SECRET");
    const session = await sessionFromReq(req, secret);
    if (!session) return json({ ok: false }, 401);
    const row = await getAccountById(env.RELAYBASE_ACCOUNTS!, session.accountId);
    if (!row) return json({ ok: false }, 401);
    return json({
      ok: true,
      account: {
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
        emailVerifiedAt: row.email_verified_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return json({ error: message }, 400);
  }
}

async function handleSignup(req: Request, env: CloudflareEnv): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400);
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400);
  }
  const account = await createAccount(env.RELAYBASE_ACCOUNTS!, email, password);
  const secret = assertEnv(env, "CONSOLE_SESSION_SECRET");
  const token = await createSession(secret, account);
  return json({ ok: true, account }, 200, {
    "Set-Cookie": setSessionCookieHeader(token),
  });
}

async function handleLogin(req: Request, env: CloudflareEnv): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const row = await verifyAccountCredentials(
    env.RELAYBASE_ACCOUNTS!,
    body.email ?? "",
    body.password ?? "",
  );
  if (!row) return json({ error: "Invalid email or password" }, 401);
  const secret = assertEnv(env, "CONSOLE_SESSION_SECRET");
  const token = await createSession(secret, { id: row.id, email: row.email });
  return json(
    {
      ok: true,
      account: { id: row.id, email: row.email, createdAt: row.created_at },
    },
    200,
    { "Set-Cookie": setSessionCookieHeader(token) },
  );
}

function handleLogout(): Response {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}

async function handleRecover(req: Request, env: CloudflareEnv): Promise<Response> {
  const body = await readJson<{ email?: string }>(req);
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400);
  const row = await env.RELAYBASE_ACCOUNTS!
    .prepare("SELECT id FROM accounts WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (row) {
    const token = await createRecoveryToken(
      env.RELAYBASE_ACCOUNTS!,
      row.id,
      "password",
      60 * 60,
    );
    // TODO: email the recovery link once SMTP is wired (SMTP_FROM).
    // In dev (no SMTP), return the token so the flow is testable.
    const devMode = !env.SMTP_FROM;
    return json({ ok: true, devToken: devMode ? token : undefined });
  }
  // Do not leak whether an account exists.
  return json({ ok: true });
}

async function handleResetPassword(
  req: Request,
  env: CloudflareEnv,
): Promise<Response> {
  const body = await readJson<{ token?: string; password?: string }>(req);
  const accountId = await consumeRecoveryToken(
    env.RELAYBASE_ACCOUNTS!,
    body.token ?? "",
    "password",
  );
  if (!accountId) return json({ error: "Invalid or expired token" }, 400);
  await setAccountPassword(env.RELAYBASE_ACCOUNTS!, accountId, body.password ?? "");
  return json({ ok: true });
}

async function handleWorkerRegister(
  req: Request,
  env: CloudflareEnv,
): Promise<Response> {
  const secret = assertEnv(env, "CONSOLE_SESSION_SECRET");
  const session = await sessionFromReq(req, secret);
  if (!session) return json({ error: "Unauthorized" }, 401);
  const body = await readJson<{ workerUrl?: string }>(req);
  await registerWorker(env.RELAYBASE_ACCOUNTS!, session.accountId, body.workerUrl ?? "");
  return json({ ok: true });
}

/**
 * Issues a one-time recovery token for ADMIN_TOKEN reset. The console admin
 * must be logged in; the token is delivered by email and later presented to
 * the customer Worker's /console/recover-admin endpoint (signed by
 * RECOVERY_SIGNING_SECRET — see lib/recovery.ts).
 */
async function handleRecoveryToken(
  req: Request,
  env: CloudflareEnv,
): Promise<Response> {
  const secret = assertEnv(env, "CONSOLE_SESSION_SECRET");
  const session = await sessionFromReq(req, secret);
  if (!session) return json({ error: "Unauthorized" }, 401);
  const token = await createRecoveryToken(
    env.RELAYBASE_ACCOUNTS!,
    session.accountId,
    "admin_token",
    15 * 60,
  );
  const devMode = !env.SMTP_FROM;
  return json({ ok: true, devToken: devMode ? token : undefined });
}
