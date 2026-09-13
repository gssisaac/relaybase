import { NextRequest } from "next/server";
import {
  CfOAuthSession,
  COOKIE_NAMES,
  readOAuthSessionCookie,
  refreshIfNeeded,
  sealOAuthSession,
} from "./session";

export class CfAuthRequiredError extends Error {}

/**
 * Read + (if needed) refresh the CF OAuth session cookie. Returns the fresh
 * session plus the sealed cookie value to re-set on the response when a
 * refresh happened (mirrors desktop's `require_cf_oauth`, minus the OS
 * keyring — the sealed cookie *is* the keyring here).
 */
export async function requireCfSession(
  request: NextRequest,
): Promise<{ session: CfOAuthSession; refreshedCookie: string | null }> {
  const raw = request.cookies.get(COOKIE_NAMES.oauth)?.value;
  const session = readOAuthSessionCookie(raw);
  if (!session) {
    throw new CfAuthRequiredError("CLOUDFLARE_AUTH_EXPIRED: Authorize with Cloudflare again");
  }
  const fresh = await refreshIfNeeded(session);
  const refreshedCookie = fresh.accessToken !== session.accessToken ? sealOAuthSession(fresh) : null;
  return { session: fresh, refreshedCookie };
}
