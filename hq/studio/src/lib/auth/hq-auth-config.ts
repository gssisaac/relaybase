const REFRESH_COOKIE = "relaybase_hq_refresh";
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const RESET_TTL_SEC = 60 * 60;

export function hqAuthConfig() {
  const jwtSecret =
    process.env.HQ_JWT_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-hq-jwt-secret-change-me");

  const appBaseUrl =
    process.env.HQ_AUTH_APP_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:32830";

  return {
    jwtSecret,
    refreshCookieName: process.env.HQ_AUTH_REFRESH_COOKIE?.trim() || REFRESH_COOKIE,
    accessTtlSec: Number(process.env.HQ_ACCESS_TTL_SEC ?? ACCESS_TTL_SEC),
    refreshTtlSec: Number(process.env.HQ_REFRESH_TTL_SEC ?? REFRESH_TTL_SEC),
    resetTtlSec: Number(process.env.HQ_RESET_TTL_SEC ?? RESET_TTL_SEC),
    appBaseUrl,
    cookiePath: "/",
  };
}

export function requireJwtSecret(): string {
  const { jwtSecret } = hqAuthConfig();
  if (!jwtSecret) {
    throw new Error("HQ_JWT_SECRET is not configured");
  }
  return jwtSecret;
}
