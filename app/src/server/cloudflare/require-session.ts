import { NextRequest } from "next/server";
import {
  CfOAuthSession,
  COOKIE_NAMES,
  readOAuthSessionCookie,
  refreshIfNeededSingleFlight,
  sealOAuthSession,
} from "./session";

export class CfAuthRequiredError extends Error {}

/**
 * Read + (if needed) refresh the CF OAuth session cookie. Returns the fresh
 * session plus the sealed cookie value to re-set on the response when a
 * refresh happened (mirrors desktop's `require_cf_oauth`, minus the OS
 * keyring — the sealed cookie *is* the keyring here).
 *
 * The refresh is single-flighted by `refresh_token`: concurrent requests
 * that share the same refresh_token all await the same Cloudflare token
 * exchange. Cloudflare rotates refresh_tokens on every exchange and
 * invalidates the old one, so without de-duplication the second parallel
 * request would arrive with an already-used token and force a re-auth.
 */
export async function requireCfSession(
  request: NextRequest,
): Promise<{ session: CfOAuthSession; refreshedCookie: string | null }> {
  const raw = request.cookies.get(COOKIE_NAMES.oauth)?.value;
  const session = readOAuthSessionCookie(raw);
  if (!session) {
    throw new CfAuthRequiredError("CLOUDFLARE_AUTH_EXPIRED: Authorize with Cloudflare again");
  }
  const fresh = await refreshIfNeededSingleFlight(session);
  const refreshedCookie = fresh.accessToken !== session.accessToken ? sealOAuthSession(fresh) : null;
  return { session: fresh, refreshedCookie };
}
