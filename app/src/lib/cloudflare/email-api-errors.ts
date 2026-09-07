export function isEmailRoutingPermissionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("cf_token_permission_missing") ||
    m.includes("/email/routing") ||
    m.includes("email routing rules") ||
    (m.includes("could not configure inbox") &&
      (m.includes("10000") ||
        m.includes("authentication error") ||
        m.includes("unauthorized") ||
        m.includes("forbidden") ||
        m.includes("permission"))) ||
    ((m.includes("10000") ||
      m.includes("authentication error") ||
      m.includes("unauthorized") ||
      m.includes("10101") ||
      m.includes("10102") ||
      m.includes("10103")) &&
      (m.includes("email") || m.includes("routing") || m.includes("zone")))
  );
}

export function isEmailApiNotConfiguredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    isEmailRoutingPermissionError(message) ||
    m.includes("cloudflare email sending is not configured") ||
    m.includes("cloudflare api is not configured") ||
    m.includes("add a cf_api_token") ||
    m.includes("cf_api_token secret") ||
    m.includes("cf_account_id") ||
    m.includes("could not configure inbox")
  );
}
