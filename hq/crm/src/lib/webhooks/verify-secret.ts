/**
 * Customer Worker webhook reporting a permanent SMTP bounce or spam complaint
 * (UC-S4, spec §5.3).
 */
export function verifyCrmWebhookSecret(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  const secret = process.env.CRM_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = c.req.header("Authorization")?.trim();
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return bearer === secret || c.req.header("X-CRM-Webhook-Secret")?.trim() === secret;
}
