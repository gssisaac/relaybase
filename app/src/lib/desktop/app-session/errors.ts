import { isUserDismissedBiometry } from "../biometry/dismiss";
import type { DesktopErrorHelp } from "../bridge";

const MISSING_WORKER_OWNER_SUMMARY =
  "No Relaybase Worker at this URL. Install Relaybase first, then sign in again.";

const MISSING_WORKER_INVITED_SUMMARY =
  "Could not reach your team's server. Contact your owner.";

/** True when the Worker URL has no Relaybase script / route (404 / Not found). */
export function isMissingWorkerError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  if (lower === "not found") return true;
  if (lower.includes("worker login failed (http 404)")) return true;
  if (/\bhttp\s+404\b/.test(lower)) return true;
  return false;
}

export function missingWorkerSummary(role: "owner" | "invited"): string {
  return role === "invited"
    ? MISSING_WORKER_INVITED_SUMMARY
    : MISSING_WORKER_OWNER_SUMMARY;
}

export function isMissingWorkerUnlockMessage(
  message: string | null | undefined,
  role?: "owner" | "invited",
): boolean {
  if (!message?.trim()) return false;
  if (role === "owner") return message === MISSING_WORKER_OWNER_SUMMARY;
  if (role === "invited") return message === MISSING_WORKER_INVITED_SUMMARY;
  return (
    message === MISSING_WORKER_OWNER_SUMMARY ||
    message === MISSING_WORKER_INVITED_SUMMARY
  );
}

export function missingWorkerHelp(role: "owner" | "invited"): DesktopErrorHelp {
  if (role === "invited") {
    return {
      title: "Could not reach the server",
      detail: "Relaybase could not connect to your team's Worker at this URL.",
      fix: "Contact your owner — they may need to install or redeploy the Worker.",
    };
  }
  return {
    title: "Worker not found",
    detail: "There is no Relaybase Worker at this URL.",
    fix: "Install Relaybase on your Cloudflare account first, then sign in again.",
  };
}

export function visibleUnlockError(
  err: unknown,
  role?: "owner" | "invited",
): string | null {
  if (isUserDismissedBiometry(err)) return null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (!message.trim() || isUserDismissedBiometry(message)) return null;
  if (role && isMissingWorkerError(err)) {
    return missingWorkerSummary(role);
  }
  if (role === "owner") {
    return normalizeOwnerLoginError(message);
  }
  return message;
}

function normalizeOwnerLoginError(message: string): string {
  const lower = message.trim().toLowerCase();
  if (lower.includes("stored passtoken didn't match")) {
    return message.trim();
  }
  if (lower.includes("invalid credentials")) {
    return "Passtoken didn't match this Worker. Check the token or use I forgot my passtoken.";
  }
  return message.trim();
}

const AUTH_OR_CLIENT_ERROR_PATTERNS = [
  "unauthorized",
  "401",
  "403",
  "forbidden",
  "session expired",
  "invalid credentials",
  "not signed in",
  "no saved session",
  "no saved mail session",
  "no saved console session",
  "sign in with your passtoken",
  "invalid passtoken",
  "invalid token",
  "token expired",
  "stored passtoken didn't match",
  "corrupt keyring",
  "not found",
  "404",
];

const TRANSPORT_UNREACHABLE_PATTERNS = [
  "error sending request",
  "error trying to connect",
  "could not reach",
  "timed out",
  "timeout",
  "connection refused",
  "connection reset",
  "network unreachable",
  "failed to connect",
  "dns error",
  "name resolution failed",
  "could not resolve host",
  "cannot resolve",
  "load failed",
  "failed to fetch",
  "network error",
  "net::err_",
];

/**
 * Worker never answered (offline / DNS / timeout). Not a 401 and not a
 * dismissed Touch ID — enrolled users should stay in the mailbox.
 */
export function isWorkerUnreachableError(err: unknown): boolean {
  if (isUserDismissedBiometry(err)) return false;
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.trim().toLowerCase();
  if (!lower) return false;

  // Explicit authentication / client errors must NEVER be classified as unreachable.
  if (AUTH_OR_CLIENT_ERROR_PATTERNS.some((p) => lower.includes(p))) {
    return false;
  }

  return TRANSPORT_UNREACHABLE_PATTERNS.some((p) => lower.includes(p));
}

/** @deprecated Use isWorkerUnreachableError or isUserDismissedBiometry */
export function isStayOnMailConsoleUnlockError(err: unknown): boolean {
  return isUserDismissedBiometry(err) || isWorkerUnreachableError(err);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "");
}

/**
 * Rust `worker_request` / `refresh_scope` refused a `/console/*` call
 * because there is no in-memory console access and no console refresh.
 * This is not a Worker 401 — the HTTP request never left the desktop —
 * but it needs the same unlock CTA / console-gate flow.
 */
export function isConsoleUnlockRequiredError(err: unknown): boolean {
  const lower = errorMessage(err).trim().toLowerCase();
  if (!lower) return false;
  return (
    lower.includes("no saved console session") ||
    lower.includes("console session expired") ||
    lower.includes("unlock the dashboard")
  );
}

/** Auth-missing errors on `/console/*` that should open the console gate. */
export function isConsoleAuthMissingError(
  err: unknown,
  workerPath: string,
): boolean {
  if (isConsoleUnlockRequiredError(err)) return true;
  if (!workerPath.startsWith("/console/") && workerPath !== "/console") return false;
  const lower = errorMessage(err).trim().toLowerCase();
  return (
    lower === "not signed in" ||
    lower.includes("no saved session") ||
    lower.includes("no saved console session") ||
    lower.includes("sign in with your passtoken") ||
    lower.includes("session expired")
  );
}

/** Auth-missing errors on `/mail/*` that should trigger mail session recovery. */
export function isMailAuthMissingError(
  err: unknown,
  workerPath: string,
): boolean {
  if (!workerPath.startsWith("/mail/") && workerPath !== "/mail") return false;
  const lower = errorMessage(err).trim().toLowerCase();
  return (
    lower === "not signed in" ||
    lower.includes("no saved session") ||
    lower.includes("no saved mail session") ||
    lower.includes("session expired") ||
    lower.includes("sign in with your passtoken") ||
    lower.includes("unauthorized")
  );
}

/** Auth-missing errors on any scoped worker path. */
export function isWorkerAuthMissingError(
  err: unknown,
  workerPath: string,
): boolean {
  return (
    isConsoleAuthMissingError(err, workerPath) ||
    isMailAuthMissingError(err, workerPath)
  );
}
