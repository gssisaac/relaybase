import type { NextRequest } from "next/server";

/**
 * Fallback redirect URI only when console OAuth config omits `redirectUri`.
 * Production authorize must use the registered console callback — see
 * `encodeWebOAuthState` in oauth-web-state.ts.
 */
export function webOAuthRedirectUri(request: NextRequest): string {
  const explicit = process.env.RELAYBASE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return new URL("/api/oauth/callback", appUrl.replace(/\/$/, "")).toString();
  }

  return new URL("/api/oauth/callback", request.nextUrl.origin).toString();
}
