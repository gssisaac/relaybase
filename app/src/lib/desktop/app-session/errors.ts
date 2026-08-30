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
    links: [{ label: "Open install setup", href: "/setup/install" }],
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
  return message;
}

/**
 * After a failed console unlock, stay on mail (do not open the passtoken
 * overlay). Covers dismissed Touch ID and Worker-unreachable / offline.
 * Expired console refresh with no keyring passtoken still opens ConsoleGateView.
 */
export function isStayOnMailConsoleUnlockError(err: unknown): boolean {
  if (isUserDismissedBiometry(err)) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  if (isUserDismissedBiometry(message)) return true;
  return (
    lower.includes("worker request failed") ||
    lower.includes("error sending request") ||
    lower.includes("error trying to connect") ||
    lower.includes("could not reach") ||
    lower.includes("timed out") ||
    lower.includes("connection refused") ||
    lower.includes("network unreachable") ||
    lower.includes("failed to connect")
  );
}
