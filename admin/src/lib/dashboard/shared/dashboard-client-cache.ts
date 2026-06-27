export const FRAMEWORK_CACHE_TTL_MS = 30 * 60 * 1000;
/** Re-fetch on page load when cached data is older than this (still within TTL). */
export const FRAMEWORK_CACHE_REFRESH_AFTER_MS = 10 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  expires: number;
  fetchedAt: number;
};

const memory = new Map<string, CacheEntry<unknown>>();

/** Bust browser localStorage after ~/.ops-dashboard/services → products migration. */
const CLIENT_CACHE_VERSION = "products-v1";

function storageKey(
  serviceId: string,
  namespace: string,
  resource: string,
): string {
  return `${CLIENT_CACHE_VERSION}:${serviceId}-${namespace}:${resource}`;
}

function readStorage<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota exceeded — memory cache still works */
  }
}

export function readDashboardCacheStale<T>(
  serviceId: string,
  namespace: string,
  resource: string,
): CacheEntry<T> | null {
  const key = storageKey(serviceId, namespace, resource);

  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem) return mem;

  const stored = readStorage<T>(key);
  if (stored) {
    memory.set(key, stored);
    return stored;
  }

  return null;
}

export function readDashboardCache<T>(
  serviceId: string,
  namespace: string,
  resource: string,
): CacheEntry<T> | null {
  const entry = readDashboardCacheStale<T>(serviceId, namespace, resource);
  if (!entry) return null;
  if (Date.now() >= entry.expires) return null;
  return entry;
}

export function readCachedOrStale<T>(
  serviceId: string,
  namespace: string,
  resource: string,
): T | null {
  return readDashboardCacheStale<T>(serviceId, namespace, resource)?.data ?? null;
}

export function writeDashboardCache<T>(
  serviceId: string,
  namespace: string,
  resource: string,
  data: T,
): void {
  const key = storageKey(serviceId, namespace, resource);
  const now = Date.now();
  const entry: CacheEntry<T> = {
    data,
    expires: now + FRAMEWORK_CACHE_TTL_MS,
    fetchedAt: now,
  };
  memory.set(key, entry);
  writeStorage(key, entry);
}

export function clearDashboardCache(
  serviceId: string,
  namespace?: string,
  resource?: string,
): void {
  if (namespace && resource) {
    const key = storageKey(serviceId, namespace, resource);
    memory.delete(key);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const prefix = namespace
    ? `${CLIENT_CACHE_VERSION}:${serviceId}-${namespace}:`
    : `${CLIENT_CACHE_VERSION}:${serviceId}-`;

  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }

  if (typeof window === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function dashboardCacheAgeMinutes(
  serviceId: string,
  namespace: string,
  resource: string,
): number | null {
  const entry = readDashboardCacheStale(serviceId, namespace, resource);
  if (!entry) return null;
  return Math.floor((Date.now() - entry.fetchedAt) / 60_000);
}

export function dashboardCacheNeedsRefresh(
  serviceId: string,
  namespace: string,
  resource: string,
): boolean {
  const entry = readDashboardCacheStale(serviceId, namespace, resource);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt >= FRAMEWORK_CACHE_REFRESH_AFTER_MS;
}
