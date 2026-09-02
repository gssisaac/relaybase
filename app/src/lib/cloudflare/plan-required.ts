/** Relaybase API code when Cloudflare Email Sending requires Workers Paid. */
export const CF_WORKERS_PAID_REQUIRED_CODE = "cf_workers_paid_required";

export const CF_PLAN_DIALOG_MESSAGE =
  "Sending uses Cloudflare Email Sending. Upgrade your Cloudflare account to Workers Paid (~$5/mo, billed by Cloudflare).";

export type CloudflarePlanErrorInput =
  | string
  | { error?: string; code?: string }
  | undefined;

/**
 * Free accounts often get zone Email Sending APIs as [2036] Unauthorized
 * instead of Email Sending’s [10105] not_entitled.
 */
function messageLooksLikePlanError(message: string): boolean {
  const lower = message.toLowerCase();
  if (
    lower.includes("[10105]") ||
    lower.includes("not_entitled") ||
    lower.includes("not entitled") ||
    lower.includes("workers paid") ||
    lower.includes("paid plan")
  ) {
    return true;
  }
  if (
    lower.includes("[2036]") &&
    lower.includes("unauthorized") &&
    lower.includes("email/sending")
  ) {
    return true;
  }
  return false;
}

/** True when Cloudflare rejected send because the account lacks Workers Paid. */
export function isCloudflarePlanError(input: CloudflarePlanErrorInput): boolean {
  if (!input) return false;
  if (typeof input === "object") {
    if (input.code === CF_WORKERS_PAID_REQUIRED_CODE) return true;
    return messageLooksLikePlanError(input.error ?? "");
  }
  return messageLooksLikePlanError(input);
}
