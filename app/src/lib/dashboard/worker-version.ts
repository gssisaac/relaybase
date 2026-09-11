/** True when the running Worker is behind the desktop app and the hosted package. */
export function workerNeedsUpgrade(
  current: string | null | undefined,
  latest: string | null | undefined,
  desktopVersion?: string | null | undefined,
): boolean {
  const cur = current?.trim() ?? "";
  const lat = latest?.trim() ?? "";
  const desk = desktopVersion?.trim() ?? "";
  if (!lat) return false;
  if (desk) {
    if (compareSemver(lat, desk) > 0) return false;
    if (cur && cur !== "unknown" && compareSemver(cur, desk) >= 0) return false;
  }
  return !cur || cur === "unknown" || cur !== lat;
}

/** True when the installed desktop app is behind the latest release. */
export function desktopBehindRelease(
  desktopVersion: string | null | undefined,
  latestVersion: string | null | undefined,
): boolean {
  const desk = desktopVersion?.trim() ?? "";
  const lat = latestVersion?.trim() ?? "";
  if (!desk || !lat) return false;
  return compareSemver(desk, lat) < 0;
}

/**
 * Mailbox-mode (invited/team) desktop update gate.
 *
 * True (allowed to install) when the Worker has not picked up `DESKTOP_VERSION`
 * yet (`workerReportedDesktopVersion` empty / `"unknown"` — fail open, never
 * worse than today's zero gating), when the candidate is itself unknown, or
 * when the candidate does not exceed the Worker's reported ceiling. False only
 * when both are known and the candidate is ahead of what the connected Worker
 * supports — i.e. the owner hasn't upgraded their Worker yet.
 */
export function teamDesktopUpdateAllowed(
  candidateVersion: string | null | undefined,
  workerReportedDesktopVersion: string | null | undefined,
): boolean {
  const cand = candidateVersion?.trim() ?? "";
  const ceiling = workerReportedDesktopVersion?.trim() ?? "";
  if (!ceiling || ceiling === "unknown") return true;
  if (!cand) return true;
  return compareSemver(cand, ceiling) <= 0;
}

/**
 * True only when both are present and the local desktop app is behind the
 * Worker's reported desktop ceiling. Mirrors `desktopBehindRelease`'s shape;
 * kept for symmetry/tests and any future "waiting on your Worker to update"
 * UI. Not required to drive the update flow — `teamDesktopUpdateAllowed`
 * handles catch-up for free (a behind candidate is also ≤ the ceiling).
 */
export function teamDesktopBehindWorker(
  localVersion: string | null | undefined,
  workerReportedDesktopVersion: string | null | undefined,
): boolean {
  const local = localVersion?.trim() ?? "";
  const ceiling = workerReportedDesktopVersion?.trim() ?? "";
  if (!local || !ceiling || ceiling === "unknown") return false;
  return compareSemver(local, ceiling) < 0;
}

export function compareSemver(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10));
  const av = parse(a);
  const bv = parse(b);
  if (
    av.length !== 3 ||
    bv.length !== 3 ||
    av.some(Number.isNaN) ||
    bv.some(Number.isNaN)
  ) {
    return a.localeCompare(b);
  }
  for (let i = 0; i < 3; i += 1) {
    if (av[i] !== bv[i]) return av[i] < bv[i] ? -1 : 1;
  }
  return 0;
}
