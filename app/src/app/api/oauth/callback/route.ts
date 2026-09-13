// Cloudflare OAuth PKCE callback — mirrors `complete_cf_oauth_inner` in
// desktop/src-tauri/src/cloudflare/loopback.rs. Exchanges the authorization
// code for tokens, resolves the CF account id, and stores everything in a
// sealed HTTP-only session cookie (the web equivalent of the desktop's
// in-memory CfOAuthSession + OS keyring refresh token).
import { NextRequest, NextResponse } from "next/server";
import { resolveAccountId } from "@/server/cloudflare/client";
import { COOKIE_NAMES, readPkceCookie, sealOAuthSession } from "@/server/cloudflare/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const setupInstall = new URL("/setup/install", request.nextUrl.origin);

  if (oauthError) {
    setupInstall.searchParams.set("cf_oauth_error", oauthError);
    return NextResponse.redirect(setupInstall);
  }

  const pkce = readPkceCookie(request.cookies.get(COOKIE_NAMES.pkce)?.value);
  if (!pkce || !code || !state || pkce.state !== state) {
    setupInstall.searchParams.set(
      "cf_oauth_error",
      "OAuth state does not match the flow you started. Try again.",
    );
    return NextResponse.redirect(setupInstall);
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
    setupInstall.searchParams.set(
      "cf_oauth_error",
      `Token exchange failed (HTTP ${tokenRes.status})`,
    );
    const response = NextResponse.redirect(setupInstall);
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

  const response = NextResponse.redirect(new URL("/setup/progress", request.nextUrl.origin));
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
      secure: true,
      sameSite: "lax",
      path: "/",
      // Session survives for as long as the refresh token would (~30 days on
      // Cloudflare); a bare access token with no refresh dies with it (~1h).
      maxAge: refreshToken ? 60 * 60 * 24 * 30 : expiresIn,
    },
  );
  return response;
}
