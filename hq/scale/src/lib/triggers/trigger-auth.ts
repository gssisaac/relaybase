import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function readBearerToken(c: Context): string | null {
  const auth = c.req.header("Authorization")?.trim();
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export function verifyTriggerWebhookSecret(c: Context, expectedSecret: string): boolean {
  const token = readBearerToken(c);
  if (!token || !expectedSecret) return false;
  return safeEqual(token, expectedSecret);
}
