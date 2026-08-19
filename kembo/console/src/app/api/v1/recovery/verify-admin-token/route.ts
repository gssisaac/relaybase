import { consumeRecoveryToken, getAccountById } from "@/lib/accounts";
import { getEnv, json } from "@/lib/env";

export const runtime = "edge";

function fail(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status);
}

/**
 * Public, token-bound verification used by customer Workers during
 * ADMIN_TOKEN recovery. The customer Worker calls this with a recovery
 * token (issued by the console to a logged-in account owner), the owner's
 * account email, and the Worker URL. We verify:
 *   1. the recovery token is valid + unused + purpose 'admin_token'
 *   2. it belongs to the account with that email
 *   3. that account has registered this workerUrl
 * On success the customer Worker may overwrite its KV admin token.
 */
export async function POST(req: Request) {
  const env = await getEnv();
  if (!env.KEMBO_ACCOUNTS) return fail("Recovery not configured", 503);

  let body: { recoveryToken?: string; accountEmail?: string; workerUrl?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("Invalid JSON");
  }
  const token = body.recoveryToken?.trim() ?? "";
  const email = body.accountEmail?.trim().toLowerCase() ?? "";
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") ?? "";
  if (!token || !email || !workerUrl) return fail("recoveryToken, accountEmail, workerUrl required");

  const accountId = await consumeRecoveryToken(
    env.KEMBO_ACCOUNTS,
    token,
    "admin_token",
  );
  if (!accountId) return fail("Invalid or expired recovery token", 400);

  const account = await getAccountById(env.KEMBO_ACCOUNTS, accountId);
  if (!account || account.email.toLowerCase() !== email) {
    return fail("Account mismatch", 403);
  }

  // Confirm this workerUrl is registered to the account.
  const registered = await env.KEMBO_ACCOUNTS.prepare(
    "SELECT 1 FROM account_workers WHERE account_id = ? AND worker_url = ?",
  )
    .bind(accountId, workerUrl)
    .first();
  if (!registered) return fail("Worker not registered to this account", 403);

  return json({ ok: true, accountId, email: account.email });
}
