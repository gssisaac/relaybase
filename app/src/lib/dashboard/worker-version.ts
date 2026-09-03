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

function compareSemver(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10));
  const av = parse(a);
  const bv = parse(b);
  if (av.length !== 3 || bv.length !== 3 || av.some(Number.isNaN) || bv.some(Number.isNaN)) {
    return a.localeCompare(b);
  }
  for (let i = 0; i < 3; i += 1) {
    if (av[i] !== bv[i]) return av[i] < bv[i] ? -1 : 1;
  }
  return 0;
}
