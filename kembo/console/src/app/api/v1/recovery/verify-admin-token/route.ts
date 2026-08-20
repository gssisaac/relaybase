import { and, eq } from "drizzle-orm";
import { consumeRecoveryToken, getAccountById } from "@/lib/accounts";
import { getDb } from "@/db/client";
import { accountWorkers } from "@/db/schema";
import { getEnv, json } from "@/lib/env";


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
  if (!env.DB) return fail("Recovery not configured", 503);

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

  const db = getDb(env);
  const accountId = await consumeRecoveryToken(db, token, "admin_token");
  if (!accountId) return fail("Invalid or expired recovery token", 400);

  const account = await getAccountById(db, accountId);
  if (!account || account.email.toLowerCase() !== email) {
    return fail("Account mismatch", 403);
  }

  // Confirm this workerUrl is registered to the account.
  const registered = await db
    .select({ accountId: accountWorkers.accountId })
    .from(accountWorkers)
    .where(and(eq(accountWorkers.accountId, accountId), eq(accountWorkers.workerUrl, workerUrl)))
    .get();
  if (!registered) return fail("Worker not registered to this account", 403);

  return json({ ok: true, accountId, email: account.email });
}
