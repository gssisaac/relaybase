import type { CfOAuthPurpose } from "./cloudflare";

export const WEB_CF_OAUTH_COMPLETE_MESSAGE = "relaybase:cf-oauth-complete";

/** Landing route after Cloudflare redirects back — notifies opener or forwards to `next`. */
export function webOAuthReturnTo(afterAuthPath: string): string {
  const next = afterAuthPath.startsWith("/") ? afterAuthPath : `/${afterAuthPath}`;
  return `/oauth/web-complete?next=${encodeURIComponent(next)}`;
}

export function webOAuthStartHref(options: {
  returnTo: string;
  purpose?: CfOAuthPurpose;
}): string {
  const params = new URLSearchParams({ returnTo: options.returnTo });
  if (options.purpose && options.purpose !== "install") {
    params.set("purpose", options.purpose);
  }
  return `/api/oauth/start?${params.toString()}`;
}

export function webOAuthStartHrefForPath(
  afterAuthPath: string,
  purpose?: CfOAuthPurpose,
): string {
  return webOAuthStartHref({
    returnTo: webOAuthReturnTo(afterAuthPath),
    purpose,
  });
}
