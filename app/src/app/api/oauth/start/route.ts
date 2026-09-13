// Starts the Cloudflare OAuth PKCE flow for the web install pipeline —
// mirrors desktop/src-tauri/src/cloudflare/loopback.rs (`start_cf_oauth_inner`),
// but the redirect target is this app's own /api/oauth/callback instead of a
// loopback port / custom URL scheme, and the verifier travels in a sealed
// cookie instead of an in-process Mutex.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES, sealPkceState } from "@/server/cloudflare/session";

function consoleBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CONSOLE_URL?.trim() || "https://console.relaybase.xyz").replace(
    /\/$/,
    "",
  );
}

function newPkceVerifier(): string {
  // 64 hex chars — well within the 43-128 unreserved-char PKCE range.
  return randomBytes(32).toString("hex");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: NextRequest) {
  const purpose = request.nextUrl.searchParams.get("purpose") === "recover" ? "recover" : "install";

  const configRes = await fetch(
    `${consoleBaseUrl()}/api/v1/oauth/config?purpose=${purpose}`,
  );
  if (!configRes.ok) {
    return NextResponse.json(
      { error: `Console rejected OAuth config (HTTP ${configRes.status})` },
      { status: 502 },
    );
  }
  const config = await configRes.json();
  const clientId: string | undefined = config.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Console did not return a clientId" }, { status: 502 });
  }
  const scopes: string =
    config.scopes ??
    (purpose === "recover" ? "secrets-store.write" : "d1.write workers-r2.write workers-scripts.write");

  // This app's own callback — must be registered as a redirect URI on the
  // Cloudflare OAuth application identified by `clientId` (one-time
  // dashboard setup, same requirement the desktop loopback/custom-scheme
  // redirect URIs have).
  const redirectUri = new URL("/api/oauth/callback", request.nextUrl.origin).toString();

  const state = randomUUID();
  const verifier = newPkceVerifier();
  const challenge = pkceChallenge(verifier);

  const authorizeUrl = new URL("https://dash.cloudflare.com/oauth2/auth");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
  response.cookies.set(
    COOKIE_NAMES.pkce,
    sealPkceState({ state, verifier, clientId, redirectUri }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/oauth",
      maxAge: 600,
    },
  );
  return response;
}
