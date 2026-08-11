import { findLicenseByEmail } from "@/lib/licenses";
import { getAccountById } from "@/lib/accounts";
import { assertEnv, getEnv, verifyRequestSession } from "@/lib/env";
import { createPortalSession } from "@/lib/stripe";

export const runtime = "edge";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const env = await getEnv();
  try {
    const secret = assertEnv(env, "CONSOLE_SESSION_SECRET");
    const session = await verifyRequestSession(req, secret);
    if (!session) return json({ error: "Unauthorized" }, 401);

    const stripeSecret = assertEnv(env, "STRIPE_SECRET_KEY");
    const account = await getAccountById(env.RELAYBASE_ACCOUNTS!, session.accountId);
    if (!account) return json({ error: "Account not found" }, 404);

    const stored = await findLicenseByEmail(env.RELAYBASE_LICENSES!, account.email);
    const customerId = stored?.stripeCustomerId ?? null;
    if (!customerId) {
      return json({ error: "No billing account found. Upgrade first." }, 404);
    }

    const origin = new URL(req.url).origin;
    const { url } = await createPortalSession(stripeSecret, {
      customerId,
      returnUrl: `${origin}/account?portal=return`,
      configuration: env.STRIPE_CUSTOMER_PORTAL_CONFIG,
    });
    return json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return json({ error: message }, 400);
  }
}
