import { assertEnv, getEnv, json } from "@/lib/env";

/**
 * Public (no auth) config the desktop needs to begin the Cloudflare OAuth
 * flow on its own. The desktop fetches { clientId, redirectUri, scopes,
 * purpose }, mints PKCE + `state`, builds the authorize URL, and opens the
 * system browser. Token exchange happens on the desktop (public PKCE client
 * — no client secret). Starting the flow does NOT require a Relaybase
 * console session.
 *
 * Two Cloudflare OAuth clients:
 * - `purpose=install` (default) — Workers / R2 / D1 for Setup and Worker update
 * - `purpose=recover` — Secrets Store Write only, for forgot-passtoken reset
 */
export async function GET(req: Request) {
  const env = await getEnv();
  const purposeRaw = new URL(req.url).searchParams.get("purpose") ?? "install";
  const purpose = purposeRaw.trim().toLowerCase();
  if (purpose !== "install" && purpose !== "recover") {
    return json({ error: "Unknown OAuth purpose" }, 400);
  }

  const redirectUri = assertEnv(env, "CF_OAUTH_REDIRECT_URI");

  // Scope IDs must match the OAuth client registration (hyphenated `.write`
  // IDs). Request only scopes the client is allowed to ask for — extras
  // (including protocol `offline_access`) make Cloudflare reject authorize
  // with a generic "authorization failed" page. Cloudflare adds
  // `offline_access` itself when the client has the refresh_token grant.
  if (purpose === "recover") {
    const clientId = assertEnv(env, "CF_OAUTH_PASSTOKEN_CLIENT_ID");
    return json({
      clientId,
      redirectUri,
      scopes: "secrets-store.write",
      purpose,
    });
  }

  const clientId = assertEnv(env, "CF_OAUTH_CLIENT_ID");
  const scopes = [
    "d1.write",
    "workers-r2.write",
    "workers-scripts.write",
  ].join(" ");

  return json({ clientId, redirectUri, scopes, purpose });
}
