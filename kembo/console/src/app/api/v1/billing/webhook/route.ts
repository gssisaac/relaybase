import { createLicense, findLicenseByCustomerId, updateLicense } from "@/lib/licenses";
import { getEnv } from "@/lib/env";
import { verifyStripeSignature, type StripeEvent } from "@/lib/stripe";

export const runtime = "edge";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const env = await getEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook not configured" }, 503);

  const rawBody = await req.text();
  const sig = req.headers.get("Stripe-Signature") ?? "";
  const ok = await verifyStripeSignature(sig, rawBody, secret);
  if (!ok) return json({ error: "Invalid signature" }, 400);

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const kv = env.KEMBO_LICENSES!;
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const email =
          obj.customer_email ||
          obj.customer_details?.email ||
          obj.metadata?.email ||
          "";
        const stripeCustomerId =
          typeof obj.customer === "string" ? obj.customer : null;
        const stripeSessionId = obj.id ?? null;
        if (!email) return json({ error: "No email on session" }, 400);

        // If this customer already has a license, skip re-issuing.
        const existing = stripeCustomerId
          ? await findLicenseByCustomerId(kv, stripeCustomerId).catch(() => null)
          : null;
        if (existing) {
          await updateLicense(kv, existing.id, {
            active: true,
            status: "active",
            stripeCustomerId: stripeCustomerId ?? existing.stripeCustomerId,
            stripeSessionId: stripeSessionId ?? existing.stripeSessionId,
          });
          return json({ received: true, licenseId: existing.id, reused: true });
        }

        const { record } = await createLicense(kv, {
          email,
          tier: "pro",
          stripeSessionId,
          stripeCustomerId,
          note: "stripe-checkout",
        });
        return json({ received: true, licenseId: record.id });
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const stripeCustomerId =
          typeof obj.customer === "string" ? obj.customer : null;
        if (!stripeCustomerId) return json({ received: true, ignored: true });
        const stored = await findLicenseByCustomerId(kv, stripeCustomerId);
        if (!stored) return json({ received: true, ignored: true });
        const currentPeriodEnd = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : null;
        const status = mapSubStatus(obj.status);
        await updateLicense(kv, stored.id, {
          active: status !== "canceled" && status !== "revoked",
          status,
          stripeSubscriptionId:
            (typeof obj.id === "string" ? obj.id : undefined) ??
            stored.stripeSubscriptionId ??
            null,
          currentPeriodEnd,
          stripeCustomerId,
        });
        return json({ received: true, updated: true });
      }

      case "customer.subscription.deleted": {
        const stripeCustomerId =
          typeof obj.customer === "string" ? obj.customer : null;
        if (!stripeCustomerId) return json({ received: true, ignored: true });
        const stored = await findLicenseByCustomerId(kv, stripeCustomerId);
        if (!stored) return json({ received: true, ignored: true });
        await updateLicense(kv, stored.id, {
          active: false,
          status: "canceled",
          currentPeriodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000).toISOString()
            : stored.currentPeriodEnd,
        });
        return json({ received: true, canceled: true });
      }

      default:
        return json({ received: true, ignored: true });
    }
  } catch (err) {
    console.error("Stripe webhook handler failed", event.type, err);
    return json({ error: "Webhook handler failed" }, 500);
  }
}

function mapSubStatus(
  status: string | undefined,
): "active" | "past_due" | "canceled" | "revoked" {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "active";
  }
}
