/** Shown when the Worker returns 404 / "Not found" for a product API. */
export const WORKER_ROUTE_MISSING_MESSAGE =
  "This Worker does not have this API yet. The app and Worker versions may not match. Open Settings → Worker update, then retry.";

const BARE_NOT_FOUND = /^(not found|404|http\s*404)$/i;
const OPAQUE_STATUS_TEXT =
  /^(not found|internal server error|bad request|unauthorized|forbidden)$/i;

export function isBareWorkerNotFound(message: string | null | undefined): boolean {
  return BARE_NOT_FOUND.test(message?.trim() ?? "");
}

export function isWorkerRouteMissingMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("worker versions may not match") ||
    lower.includes("does not have this api yet") ||
    lower.includes("does not support") ||
    lower.includes("check for a worker update")
  );
}

/**
 * Never surface Hono's raw "Not found" — users cannot tell a missing route
 * from an empty list. 404 almost always means the running Worker is older
 * than the app (or the URL is not a Relaybase Worker).
 */
export function formatWorkerApiError(
  status: number,
  bodyError: string | undefined,
  action: string,
): string {
  const raw = bodyError?.trim() ?? "";
  if (status === 404 || isBareWorkerNotFound(raw)) {
    return WORKER_ROUTE_MISSING_MESSAGE;
  }
  if (status === 401 || /^unauthorized$/i.test(raw)) {
    return "Your session expired. Unlock the dashboard and try again.";
  }
  if (raw && !OPAQUE_STATUS_TEXT.test(raw)) {
    return raw;
  }
  return `${action} failed (HTTP ${status}). The Worker may be an older version — check Settings → Worker update.`;
}

/** Last-chance rewrite if a caller still threw the raw Worker body. */
export function rewriteBareWorkerError(message: string): string {
  if (isBareWorkerNotFound(message)) return WORKER_ROUTE_MISSING_MESSAGE;
  return message;
}
