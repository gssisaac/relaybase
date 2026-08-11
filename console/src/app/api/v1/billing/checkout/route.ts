import { getAccountById } from "@/lib/accounts";
import { assertEnv, getEnv, verifyRequestSession } from "@/lib/env";
import { createCheckoutSession } from "@/lib/stripe";

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
    const priceId = assertEnv(env, "STRIPE_PRICE_PRO");
    const account = await getAccountById(env.RELAYBASE_ACCOUNTS!, session.accountId);
    if (!account) return json({ error: "Account not found" }, 404);

    const body = (await req.json().catch(() => ({}))) as {
      annual?: boolean;
    };
    const useAnnual = Boolean(body.annual) && env.STRIPE_PRICE_PRO_ANNUAL;
    const effectivePriceId = useAnnual
      ? assertEnv(env, "STRIPE_PRICE_PRO_ANNUAL")
      : priceId;

    const origin = new URL(req.url).origin;
    const { url } = await createCheckoutSession(stripeSecret, {
      priceId: effectivePriceId,
      customerEmail: account.email,
      successUrl: `${origin}/account?checkout=success`,
      cancelUrl: `${origin}/account?checkout=cancel`,
      metadata: { accountId: account.id, email: account.email },
    });
    return json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return json({ error: message }, 400);
  }
}
