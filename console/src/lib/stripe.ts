import { sha256Hex } from "./crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown> & {
      id?: string;
      customer?: string;
      customer_email?: string;
      customer_details?: { email?: string };
      metadata?: Record<string, string | undefined>;
      current_period_end?: number;
      current_period_start?: number;
      status?: string;
      cancel_at_period_end?: boolean;
    };
  };
};

/**
 * Verify a Stripe webhook signature header against the raw request body
 * using Stripe's t=...,v1=... scheme (HMAC-SHA256).
 */
export async function verifyStripeSignature(
  sigHeader: string,
  rawBody: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = new Map<string, string>();
  for (const item of sigHeader.split(",")) {
    const idx = item.indexOf("=");
    if (idx === -1) continue;
    parts.set(item.slice(0, idx).trim(), item.slice(idx + 1).trim());
  }
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${t}.${rawBody}`) as BufferSource,
  );
  const expected = Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return timingSafeEqualStr(expected, v1);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function stripeFetch(
  secretKey: string,
  path: string,
  init: { method?: string; body?: URLSearchParams } = {},
): Promise<Response> {
  return fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body,
  });
}

export async function createCheckoutSession(
  secretKey: string,
  params: {
    priceId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  },
): Promise<{ url: string }> {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("customer_email", params.customerEmail);
  form.set("line_items[0][price]", params.priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  if (params.metadata) {
    for (const [k, v] of Object.entries(params.metadata)) {
      form.set(`metadata[${k}]`, v);
    }
  }
  const res = await stripeFetch(secretKey, "/checkout/sessions", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    throw new Error(data.error?.message ?? "Stripe checkout failed");
  }
  return { url: data.url };
}

export async function createPortalSession(
  secretKey: string,
  params: {
    customerId: string;
    returnUrl: string;
    configuration?: string;
  },
): Promise<{ url: string }> {
  const form = new URLSearchParams();
  form.set("customer", params.customerId);
  form.set("return_url", params.returnUrl);
  if (params.configuration) form.set("configuration", params.configuration);
  const res = await stripeFetch(secretKey, "/billing_portal/sessions", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    throw new Error(data.error?.message ?? "Stripe portal failed");
  }
  return { url: data.url };
}

export async function findCustomerByEmail(
  secretKey: string,
  email: string,
): Promise<string | null> {
  const form = new URLSearchParams();
  form.set("email", email);
  form.set("limit", "1");
  const res = await stripeFetch(secretKey, "/customers", { body: form });
  const data = (await res.json()) as {
    data?: Array<{ id: string }>;
  };
  return data.data?.[0]?.id ?? null;
}

export async function createCustomer(
  secretKey: string,
  email: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const form = new URLSearchParams();
  form.set("email", email);
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) form.set(`metadata[${k}]`, v);
  }
  const res = await stripeFetch(secretKey, "/customers", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? "Stripe customer create failed");
  }
  return data.id;
}

export function emailKey(email: string): string {
  return `srv:account:email:${email.trim().toLowerCase()}`;
}

export { sha256Hex };
