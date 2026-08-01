/** Human-readable permission hints for Cloudflare API auth failures (code 10000). */
export function cloudflarePermissionHint(
  path: string,
  method = "GET",
): string | null {
  const m = method.toUpperCase();
  const p = path.split("?")[0] ?? path;

  if (p.includes("/email/sending/send")) {
    return [
      `Endpoint: ${m} /accounts/{{account_id}}/email/sending/send`,
      "Required: Account → Email Sending → Edit",
      "The From domain must be onboarded in Cloudflare → Email Service → Email Sending.",
      "Before onboarding, you can only send to verified destination addresses.",
    ].join("\n");
  }

  if (p.includes("/email/routing/enable")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing/enable`,
      "Required: Zone → Zone Settings → Edit",
    ].join("\n");
  }

  if (p.includes("/email/routing/rules")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing/rules`,
      "Required: Zone → Email Routing Rules → Edit",
    ].join("\n");
  }

  if (p.includes("/zones") && !p.includes("/email/")) {
    return [
      `Endpoint: ${m} /zones`,
      "Required: Zone → Zone → Read",
    ].join("\n");
  }

  return null;
}

/** Hints for Email Sending API errors (non-auth). */
export function cloudflareSendingErrorHint(
  errors?: Array<{ code?: number; message?: string }>,
): string | null {
  const code = errors?.[0]?.code;
  const msg = errors?.[0]?.message ?? "";

  if (code === 10002 || msg.includes("internal_server")) {
    return [
      "Cloudflare returned an internal sending error (10002). Common causes:",
      "• The From domain is not onboarded in Cloudflare Email Sending",
      "• Sending DNS records are missing or not verified yet",
      "• API token needs Account → Email Sending → Edit",
      "• Before the domain is fully enabled, send only to verified destination addresses",
      "Retry after fixing setup; if it persists, check Cloudflare status or support.",
    ].join("\n");
  }

  if (code === 10203 || msg.includes("sending_disabled")) {
    return "Email Sending is disabled for this domain or account. Onboard the domain in Cloudflare Email Sending and verify DNS records.";
  }

  if (code === 10105 || msg.includes("not_entitled")) {
    return "This Cloudflare account is not entitled to Email Sending. Enroll in Email Service in the Cloudflare dashboard.";
  }

  if (code === 10102 || code === 10103 || msg.includes("forbidden")) {
    return "API token lacks Email Sending permission. Add Account → Email Sending → Edit.";
  }

  if (code === 10100 || msg.includes("upstream")) {
    return "Cloudflare authentication service is temporarily unavailable. Retry in a few minutes.";
  }

  return null;
}
