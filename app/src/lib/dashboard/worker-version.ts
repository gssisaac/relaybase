/** True when the running Worker is missing, unknown, or behind the hosted package. */
export function workerNeedsUpgrade(
  current: string | null | undefined,
  latest: string | null | undefined,
): boolean {
  const cur = current?.trim() ?? "";
  const lat = latest?.trim() ?? "";
  if (!lat) return false;
  return !cur || cur === "unknown" || cur !== lat;
}
