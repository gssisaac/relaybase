// Cloudflare OAuth PKCE callback — mirrors `complete_cf_oauth_inner` in
// desktop/src-tauri/src/cloudflare/loopback.rs. Exchanges the authorization
// code for tokens, resolves the CF account id, and stores everything in a
// sealed HTTP-only session cookie (the web equivalent of the desktop's
// in-memory CfOAuthSession + OS keyring refresh token).
import { NextRequest, NextResponse } from "next/server";
import { resolveAccountId } from "@/server/cloudflare/client";
import { RECOVER_ADMIN_PATH } from "@/lib/navigation/recover-admin";
import { COOKIE_NAMES, readPkceCookie, sealOAuthSession } from "@/server/cloudflare/session";

function oauthErrorDestination(
  request: NextRequest,
  pkce: ReturnType<typeof readPkceCookie>,
  message: string,
): URL {
  const fallback =
    pkce?.returnTo?.trim() ||
    (pkce?.purpose === "recover" ? RECOVER_ADMIN_PATH : "/setup/install");
  const destination = new URL(fallback, request.nextUrl.origin);
  destination.searchParams.set("cf_oauth_error", message);
  return destination;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const pkceEarly = readPkceCookie(request.cookies.get(COOKIE_NAMES.pkce)?.value);

  if (oauthError) {
    const description = request.nextUrl.searchParams.get("error_description") ?? oauthError;
    return NextResponse.redirect(oauthErrorDestination(request, pkceEarly, description));
  }

  const pkce = pkceEarly;
  if (!pkce || !code || !state || pkce.state !== state) {
    return NextResponse.redirect(
      oauthErrorDestination(
        request,
        pkce,
        "OAuth state does not match the flow you started. Try again.",
      ),
    );
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: pkce.redirectUri,
    client_id: pkce.clientId,
    code_verifier: pkce.verifier,
  });
  const tokenRes = await fetch("https://dash.cloudflare.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    const response = NextResponse.redirect(
      oauthErrorDestination(request, pkce, `Token exchange failed (HTTP ${tokenRes.status})`),
    );
    response.cookies.delete(COOKIE_NAMES.pkce);
    return response;
  }
  const tokens = JSON.parse(tokenText);
  const accessToken: string = tokens.access_token;
  const refreshToken: string = tokens.refresh_token ?? "";
  const expiresIn: number = Number(tokens.expires_in ?? 3600);

  let accountId = String(tokens.account_id ?? "").trim();
  if (!accountId) {
    try {
      accountId = await resolveAccountId(accessToken);
    } catch {
      // Some recover-scope tokens cannot list /accounts — proceed without;
      // the install routes will surface a clear error if it's actually needed.
      accountId = "";
    }
  }

  const returnPath =
    pkce.returnTo?.trim() ||
    (pkce.purpose === "recover" ? RECOVER_ADMIN_PATH : "/setup/progress");
  const destination = new URL(returnPath, request.nextUrl.origin);
  destination.searchParams.set("cf_oauth", "complete");
  const response = NextResponse.redirect(destination);
  response.cookies.delete(COOKIE_NAMES.pkce);
  response.cookies.set(
    COOKIE_NAMES.oauth,
    sealOAuthSession({
      accessToken,
      refreshToken,
      accountId,
      clientId: pkce.clientId,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // Session survives for as long as the refresh token would (~30 days on
      // Cloudflare); a bare access token with no refresh dies with it (~1h).
      maxAge: refreshToken ? 60 * 60 * 24 * 30 : expiresIn,
    },
  );
  return response;
}
