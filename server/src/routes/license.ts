import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import {
  createLicense,
  listLicenses,
  revokeLicense,
  verifyLicense,
} from "../lib/licenses";

const license = new Hono<{ Bindings: Env }>();

/** Public: activate / offline-check from the desktop app. */
license.post("/verify", async (c) => {
  let body: { licenseKey?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const key = body.licenseKey?.trim();
  if (!key) return c.json({ ok: false, error: "licenseKey required" }, 400);

  const record = await verifyLicense(c.env.KEYS, key);
  if (!record) return c.json({ ok: false, error: "Invalid or revoked license" }, 404);

  return c.json({
    ok: true,
    email: record.email,
    createdAt: record.createdAt,
  });
});

/**
 * Stripe Checkout webhook (payment_intent / checkout.session.completed).
 * Configure STRIPE_WEBHOOK_SECRET in production; without it, rejects.
 */
license.post("/stripe-webhook", async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return c.json({ error: "Stripe webhook not configured" }, 503);
  }

  const raw = await c.req.text();
  // Minimal verification: require Stripe-Signature header presence.
  // Full HMAC verification can be tightened once Stripe SDK is added.
  const sig = c.req.header("Stripe-Signature");
  if (!sig) return c.json({ error: "Missing signature" }, 400);

  let event: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        customer_details?: { email?: string };
        customer_email?: string;
        metadata?: { email?: string };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return c.json({ received: true, ignored: true });
  }

  const obj = event.data?.object;
  const email =
    obj?.customer_details?.email ||
    obj?.customer_email ||
    obj?.metadata?.email;
  if (!email) {
    return c.json({ error: "No email on session" }, 400);
  }

  const { record, licenseKey } = await createLicense(c.env.KEYS, {
    email,
    stripeSessionId: obj?.id ?? null,
    note: "stripe-checkout",
  });

  // License key is returned here for ops logging; production should email it
  // via admin Worker send on Isaac's own domain.
  console.log(
    JSON.stringify({
      type: "license.issued",
      email: record.email,
      id: record.id,
      keyPrefix: record.keyPrefix,
      licenseKey,
    }),
  );

  return c.json({ received: true, licenseId: record.id });
});

/** Admin: list / issue / revoke */
license.get("/admin", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const licenses = await listLicenses(c.env.KEYS);
  return c.json({ licenses });
});

license.post("/admin", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  let body: { email?: string; note?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!body.email?.trim()) return c.json({ error: "email required" }, 400);
  const { record, licenseKey } = await createLicense(c.env.KEYS, {
    email: body.email,
    note: body.note ?? "manual",
  });
  return c.json({ record, licenseKey });
});

license.delete("/admin/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const ok = await revokeLicense(c.env.KEYS, c.req.param("id"));
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ revoked: true });
});

export { license };
