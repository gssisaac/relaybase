import {
  fetchCachedApi,
  fetchCachedApiOptional,
  type CacheMeta,
} from "@/lib/dashboard/shared/cached-fetch";
import { clearDashboardCache } from "@/lib/dashboard/shared/dashboard-client-cache";

const NAMESPACE = "email";

export type FetchEmailOptions<T> = {
  refresh?: boolean;
  onUpdate?: (data: T) => void;
};

function normalizeOptions<T>(
  refreshOrOptions?: boolean | FetchEmailOptions<T>,
): FetchEmailOptions<T> | undefined {
  if (typeof refreshOrOptions === "boolean") {
    return { refresh: refreshOrOptions };
  }
  return refreshOrOptions;
}

export function clearEmailCache(serviceId: string, resource?: string): void {
  clearDashboardCache(serviceId, NAMESPACE, resource);
}

export function fetchEmailCached<T>(
  serviceId: string,
  resource: string,
  url: string,
  refreshOrOptions?: boolean | FetchEmailOptions<T>,
): Promise<{ data: T; meta: CacheMeta }> {
  return fetchCachedApi<T>(
    serviceId,
    NAMESPACE,
    resource,
    url,
    normalizeOptions(refreshOrOptions),
  );
}

export function fetchEmailCachedOptional<T>(
  serviceId: string,
  resource: string,
  url: string,
  refreshOrOptions?: boolean | FetchEmailOptions<T>,
): Promise<{ data: T | null; meta: CacheMeta; ok: boolean }> {
  return fetchCachedApiOptional<T>(
    serviceId,
    NAMESPACE,
    resource,
    url,
    normalizeOptions(refreshOrOptions),
  );
}
