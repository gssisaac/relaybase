import { normalizeWorkerUrl } from "./worker-url";

const STORAGE_KEY = "relaybase.recentWorkerUrls";
const MAX_RECENT = 8;

function readRaw(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map(normalizeWorkerUrl)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeRaw(urls: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
  } catch {
    /* quota / private mode */
  }
}

/** Persist a Worker URL at the front of the recents list (deduped). */
export function rememberWorkerUrl(url: string): void {
  const normalized = normalizeWorkerUrl(url);
  if (!normalized) return;
  const next = [
    normalized,
    ...readRaw().filter((item) => item !== normalized),
  ].slice(0, MAX_RECENT);
  writeRaw(next);
}

export function loadRecentWorkerUrls(): string[] {
  return readRaw();
}

/** Merge disk/keyring seeds with stored recents; seeds first when new. */
export function mergeRecentWorkerUrls(
  ...seeds: Array<string | undefined | null>
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const seed of seeds) {
    const normalized = normalizeWorkerUrl(seed);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }
  for (const recent of readRaw()) {
    if (seen.has(recent)) continue;
    seen.add(recent);
    merged.push(recent);
  }
  return merged.slice(0, MAX_RECENT);
}
