/** sessionStorage key: epoch-ms until which a Worker 401 must not wipe credentials. */
const SKIP_UNAUTHORIZED_UNTIL_KEY = "relaybase:skip-unauthorized-until";

/** Window after a Worker update / passtoken rotate where a stale isolate 401 is expected. */
export const WORKER_UPDATE_GRACE_MS = 60_000;

export function markWorkerUpdateGrace(
  graceMs = WORKER_UPDATE_GRACE_MS,
): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    SKIP_UNAUTHORIZED_UNTIL_KEY,
    String(Date.now() + graceMs),
  );
}

export function isUnauthorizedGraceActive(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(SKIP_UNAUTHORIZED_UNTIL_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    window.sessionStorage.removeItem(SKIP_UNAUTHORIZED_UNTIL_KEY);
    return false;
  }
  return true;
}
