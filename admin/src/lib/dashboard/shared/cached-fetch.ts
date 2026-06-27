import {
  clearDashboardCache,
  dashboardCacheAgeMinutes,
  dashboardCacheNeedsRefresh,
  readCachedOrStale,
  readDashboardCache,
  readDashboardCacheStale,
  writeDashboardCache,
} from "@/lib/dashboard/shared/dashboard-client-cache";

export type CacheMeta = {
  fromCache: boolean;
  ageMinutes: number;
};

export function cacheHintText(
  fromCache: boolean,
  ageMinutes: number,
): string | null {
  if (!fromCache) return null;
  if (ageMinutes <= 0) return "Cached just now";
  if (ageMinutes === 1) return "Cached 1 min ago";
  return `Cached ${ageMinutes} min ago`;
}

export function oldestCacheMeta(...metas: Array<CacheMeta | null | undefined>): CacheMeta | null {
  const cached = metas.filter(
    (meta): meta is CacheMeta => Boolean(meta?.fromCache),
  );
  if (cached.length === 0) return null;
  return cached.reduce((oldest, current) =>
    current.ageMinutes >= oldest.ageMinutes ? current : oldest,
  );
}

export { readCachedOrStale, readDashboardCacheStale };

function staleMeta(
  serviceId: string,
  namespace: string,
  resource: string,
): CacheMeta {
  return {
    fromCache: true,
    ageMinutes:
      dashboardCacheAgeMinutes(serviceId, namespace, resource) ?? 0,
  };
}

function shouldForceRefresh(
  serviceId: string,
  namespace: string,
  resource: string,
  explicit?: boolean,
): boolean {
  return (
    explicit === true ||
    dashboardCacheNeedsRefresh(serviceId, namespace, resource)
  );
}

export async function fetchWithDashboardCache<T>(
  serviceId: string,
  namespace: string,
  resource: string,
  fetcher: () => Promise<T>,
  options?: { refresh?: boolean; onUpdate?: (data: T) => void },
): Promise<{ data: T; meta: CacheMeta }> {
  if (
    !shouldForceRefresh(serviceId, namespace, resource, options?.refresh)
  ) {
    const stale = readDashboardCacheStale<T>(serviceId, namespace, resource);
    if (stale) {
      const fresh = readDashboardCache<T>(serviceId, namespace, resource);
      if (!fresh) {
        void (async () => {
          try {
            const data = await fetcher();
            writeDashboardCache(serviceId, namespace, resource, data);
            options?.onUpdate?.(data);
          } catch {
            /* keep stale data on background failure */
          }
        })();
      }
      return { data: stale.data, meta: staleMeta(serviceId, namespace, resource) };
    }
  } else {
    clearDashboardCache(serviceId, namespace, resource);
  }

  const data = await fetcher();
  writeDashboardCache(serviceId, namespace, resource, data);
  return { data, meta: { fromCache: false, ageMinutes: 0 } };
}

export async function fetchCachedApi<T>(
  serviceId: string,
  namespace: string,
  resource: string,
  url: string,
  options?: { refresh?: boolean; onUpdate?: (data: T) => void },
): Promise<{ data: T; meta: CacheMeta }> {
  return fetchWithDashboardCache(
    serviceId,
    namespace,
    resource,
    async () => {
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error ?? `Failed to load ${resource}`,
        );
      }
      return json as T;
    },
    options,
  );
}

export async function fetchCachedApiOptional<T>(
  serviceId: string,
  namespace: string,
  resource: string,
  url: string,
  options?: { refresh?: boolean; onUpdate?: (data: T) => void },
): Promise<{ data: T | null; meta: CacheMeta; ok: boolean }> {
  if (
    !shouldForceRefresh(serviceId, namespace, resource, options?.refresh)
  ) {
    const stale = readDashboardCacheStale<T>(serviceId, namespace, resource);
    if (stale) {
      const fresh = readDashboardCache<T>(serviceId, namespace, resource);
      if (!fresh) {
        void (async () => {
          try {
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) return;
            const data = json as T;
            writeDashboardCache(serviceId, namespace, resource, data);
            options?.onUpdate?.(data);
          } catch {
            /* keep stale */
          }
        })();
      }
      return {
        data: stale.data,
        ok: true,
        meta: staleMeta(serviceId, namespace, resource),
      };
    }
  } else {
    clearDashboardCache(serviceId, namespace, resource);
  }

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    return {
      data: null,
      ok: false,
      meta: { fromCache: false, ageMinutes: 0 },
    };
  }

  const data = json as T;
  writeDashboardCache(serviceId, namespace, resource, data);
  return { data, ok: true, meta: { fromCache: false, ageMinutes: 0 } };
}
