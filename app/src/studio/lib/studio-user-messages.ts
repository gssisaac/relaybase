const DEV =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

/** User-facing copy when Studio API calls fail (production-safe). */
export const studioUserMessages = {
  loadNewsletters: "Could not load newsletters. Try again or sign in again.",
  loadDashboard: "Could not load dashboard. Try again in a moment.",
  loadAnalytics: "Could not load analytics. Try again in a moment.",
  loadSchedule: "Could not load schedule. Try again in a moment.",
  loadTriggerStats: "Could not load trigger statistics. Try again in a moment.",
  dashboardUnavailable: "Dashboard data is unavailable right now. Refresh to try again.",
  analyticsUnavailable: "Analytics data is unavailable right now. Refresh to try again.",
  studioUnavailable: "Studio is temporarily unavailable. Try again in a moment.",
  studioUpstream: "Studio is temporarily unavailable. Try again in a moment.",
  signInUnavailable: "Sign-in service is unavailable. Try again later.",
} as const;

export function studioLoadErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (err instanceof Error && err.message && !isDevOnlyStudioMessage(err.message)) {
    return err.message;
  }
  return fallback;
}

export function studioApiFetchFallback(status: number, contentType: string | null): string {
  if (contentType?.includes("text/html")) {
    return studioUserMessages.studioUnavailable;
  }
  return `Request failed (${status})`;
}

export function studioApiNonJsonMessage(): string {
  return studioUserMessages.studioUnavailable;
}

export function studioAuthNotFoundMessage(): string {
  if (DEV) {
    return "Studio auth API not found — start hq/studio on port 32832 (not 32831; desktop OAuth uses that port).";
  }
  return studioUserMessages.signInUnavailable;
}

export function studioMiddlewareUpstreamError(): string {
  if (DEV) {
    return "Studio upstream unreachable — start hq/studio or set STUDIO_UPSTREAM_URL";
  }
  return studioUserMessages.studioUpstream;
}

function isDevOnlyStudioMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("32832") ||
    lower.includes("32831") ||
    lower.includes("hq/studio") ||
    lower.includes("pnpm dev") ||
    lower.includes("studio_upstream_url")
  );
}

/** Example Worker URL when the user has not connected a Worker yet. */
export function exampleWorkerApiBaseUrl(): string {
  return "https://relaybase-api.<your-subdomain>.workers.dev";
}
