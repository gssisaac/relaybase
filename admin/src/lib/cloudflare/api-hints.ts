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

  if (p.includes("/email/routing/addresses")) {
    return [
      `Endpoint: ${m} /accounts/{{account_id}}/email/routing/addresses`,
      "Required: Account → Email Routing Addresses → Read (or Edit)",
    ].join("\n");
  }

  if (p.includes("/email/sending/subdomains") && m === "POST") {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/sending/subdomains`,
      "Required: Account → Email Sending → Edit",
      "Onboards the domain for Email Sending (same as Compute → Email Service → Email Sending → Onboard Domain).",
      "There is no separate Zone → Email Sending permission in the API token UI.",
    ].join("\n");
  }

  if (p.includes("/email/sending/subdomains")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/sending/subdomains`,
      "Required: Account → Email Sending → Edit",
      "Lists onboarded sending domains for the zone.",
    ].join("\n");
  }

  if (p.includes("/email/routing/enable")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing/enable`,
      "Required: Zone → Zone Settings → Edit",
    ].join("\n");
  }

  if (p.includes("/email/routing") && !p.includes("/rules")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing`,
      "Required: Zone → Zone Settings → Read (or Email Routing Rules → Read)",
    ].join("\n");
  }

  if (p.includes("/email/routing/rules")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing/rules`,
      "Required: Zone → Email Routing Rules → Read (or Edit)",
    ].join("\n");
  }

  if (p.includes("/pages/projects")) {
    if (p.includes("/deployments") && m === "POST") {
      return [
        `Endpoint: ${m} /accounts/{{account_id}}/pages/projects/{{project}}/deployments`,
        "Required: Account → Cloudflare Pages → Edit",
        "Use the API token saved in MacPurity → Website settings (not Email).",
      ].join("\n");
    }
    if (p.includes("/deployments")) {
      return [
        `Endpoint: ${m} /accounts/{{account_id}}/pages/projects/{{project}}/deployments`,
        "Required: Account → Cloudflare Pages → Read",
        "Use the API token saved in MacPurity → Website settings (not Email).",
      ].join("\n");
    }
    if (p.includes("/domains")) {
      return [
        `Endpoint: ${m} /accounts/{{account_id}}/pages/projects/{{project}}/domains`,
        "Required: Account → Cloudflare Pages → Read (or Edit)",
        "Use the API token saved in MacPurity → Website settings (not Email).",
      ].join("\n");
    }
    return [
      `Endpoint: ${m} /accounts/{{account_id}}/pages/projects/{{project}}`,
      "Required: Account → Cloudflare Pages → Read (or Edit)",
      "Use the API token saved in MacPurity → Website settings (not Email).",
    ].join("\n");
  }

  if (p.includes("/workers/scripts")) {
    return [
      `Endpoint: ${m} /accounts/{{account_id}}/workers/scripts`,
      "Required: Account → Workers Scripts → Read (or Edit)",
      "Use the API token saved in MacPurity → Website settings (not Email).",
    ].join("\n");
  }

  if (p.includes("/dns_records")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/dns_records`,
      "Required: Zone → DNS → Read (or Edit)",
    ].join("\n");
  }

  if (p.startsWith("/zones?name=") || (p.startsWith("/zones/") && p.endsWith("/zones"))) {
    return [
      `Endpoint: ${m} /zones`,
      "Required: Zone → Read",
    ].join("\n");
  }

  if (p.includes("/graphql")) {
    return [
      "Endpoint: POST /graphql (Email Service analytics)",
      "Required: Zone → Analytics → Read",
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
      "• The From domain is not onboarded — Settings → Domain connection → Onboard Email Sending",
      "• Sending DNS records are missing or not verified yet",
      "• API token needs Account → Email Sending → Edit and Zone → Email Sending → Edit",
      "• Before the domain is fully enabled, send only to verified destination addresses",
      "Retry after fixing setup; if it persists, check Cloudflare status or support.",
    ].join("\n");
  }

  if (code === 10203 || msg.includes("sending_disabled")) {
    return "Email Sending is disabled for this domain or account. Onboard the domain in Settings → Domain connection and verify DNS records.";
  }

  if (code === 10105 || msg.includes("not_entitled")) {
    return "This Cloudflare account is not entitled to Email Sending. Enroll in Email Service in the Cloudflare dashboard.";
  }

  if (code === 10102 || code === 10103 || msg.includes("forbidden")) {
    return "API token lacks Email Sending permission. Add Account → Email Sending → Edit.";
  }

  if (code === 10100 || msg.includes("upstream")) {
    return "Cloudflare authentication product is temporarily unavailable. Retry in a few minutes.";
  }

  return null;
}

export function enrichCloudflareAuthError(
  message: string,
  path: string,
  method = "GET",
): string {
  const isAuthError =
    message.includes("[10000]") ||
    message.toLowerCase().includes("authentication error") ||
    message.toLowerCase().includes("missing permission");

  if (!isAuthError) return message;

  const hint = cloudflarePermissionHint(path, method);
  if (!hint) {
    return `${message}\n\nAPI path: ${method} ${path}\nCheck token permissions for this endpoint in Settings → Cloudflare.`;
  }

  if (message.includes(hint.split("\n")[0]!)) return message;

  return `${message}\n\n${hint}`;
}
