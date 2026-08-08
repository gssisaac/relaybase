"use client";

import { useCallback, useState } from "react";

import { readCachedOrStale } from "@/lib/dashboard/shared/dashboard-client-cache";

const CACHE_NS = "email";

export function readEmailStale<T>(
  serviceId: string,
  resource: string,
): T | null {
  return readCachedOrStale<T>(serviceId, CACHE_NS, resource);
}

export function useEmailViewLoading(
  serviceId: string,
  resources: string[],
): {
  loading: boolean;
  refreshing: boolean;
  setLoading: (v: boolean) => void;
  beginRefresh: (hasData: boolean) => void;
  endRefresh: () => void;
} {
  const hasStale = resources.some(
    (r) => readCachedOrStale(serviceId, CACHE_NS, r) !== null,
  );
  const [loading, setLoading] = useState(!hasStale);
  const [refreshing, setRefreshing] = useState(false);

  const beginRefresh = useCallback(
    (hasData: boolean) => {
      if (!hasData) setLoading(true);
      setRefreshing(true);
    },
    [],
  );

  const endRefresh = useCallback(() => {
    setLoading(false);
    setRefreshing(false);
  }, []);

  return { loading, refreshing, setLoading, beginRefresh, endRefresh };
}
