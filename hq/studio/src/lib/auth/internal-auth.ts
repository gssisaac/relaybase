import { timingSafeEqual } from "node:crypto";
import { requireJwtSecret } from "./hq-auth-config";

/** Server-to-server calls from the web app (register-cloud), not browsers. */
export function verifyInternalAuthHeader(header: string | undefined): boolean {
  const expected = process.env.HQ_INTERNAL_AUTH_SECRET?.trim() || requireJwtSecret();
  const provided = header?.trim() ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
