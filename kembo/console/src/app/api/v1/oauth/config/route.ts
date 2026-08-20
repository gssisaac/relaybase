import { assertEnv, getEnv, json } from "@/lib/env";

/**
 * Public (no auth) config the desktop needs to begin the Cloudflare OAuth
 * flow on its own. The desktop fetches { clientId, redirectUri, scopes },
 * mints PKCE + `state`, builds the authorize URL, and opens the system
 * browser. Token exchange happens on the desktop (public PKCE client — no
 * client secret). Starting the flow does NOT require a Relaybase console session.
 */
export async function GET() {
  const env = await getEnv();
  const clientId = assertEnv(env, "CF_OAUTH_CLIENT_ID");
  const redirectUri = assertEnv(env, "CF_OAUTH_REDIRECT_URI");

  // Scope IDs must match the OAuth client registration (hyphenated `.write`
  // IDs). Request only scopes the client is allowed to ask for — extras
  // (including protocol `offline_access`) make Cloudflare reject authorize
  // with a generic "authorization failed" page. Cloudflare adds
  // `offline_access` itself when the client has the refresh_token grant.
  const scopes = [
    "d1.write",
    "secrets-store.write",
    "workers-r2.write",
    "workers-scripts.write",
  ].join(" ");

  return json({ clientId, redirectUri, scopes });
}
