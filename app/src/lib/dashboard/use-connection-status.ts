"use client";

import { useCallback, useEffect, useState } from "react";

import {
  dashboardCacheNeedsRefresh,
  loadDashboardCache,
  saveDashboardCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import {
  cfConnectedFromCredentials,
  probeConnectionStatus,
  type ConnectionStatusSnapshot,
} from "@/lib/dashboard/connection-status";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";

export const CONNECTION_STATUS_CACHE_KEY = "connection-status";

export function useConnectionStatus() {
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;

  const [snapshot, setSnapshot] = useState<ConnectionStatusSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (force?: boolean) => {
      const cached =
        await loadDashboardCache<ConnectionStatusSnapshot>(
          CONNECTION_STATUS_CACHE_KEY,
        );

      if (cached?.data) {
        setSnapshot(cached.data);
        setLoading(false);
      } else {
        setSnapshot({
          cfConnected: cfConnectedFromCredentials(credentials),
          worker: null,
        });
      }

      const needsNetwork =
        force === true ||
        !cached?.data ||
        dashboardCacheNeedsRefresh(cached.fetchedAt);

      if (!needsNetwork) return;

      if (cached?.data) setRefreshing(true);
      else setLoading(true);

      try {
        const next = await probeConnectionStatus(credentials);
        setSnapshot(next);
        await saveDashboardCache(CONNECTION_STATUS_CACHE_KEY, next);
      } catch {
        const fallback: ConnectionStatusSnapshot = {
          cfConnected: cfConnectedFromCredentials(credentials),
          worker: null,
        };
        setSnapshot((prev) => prev ?? fallback);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [credentials],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    snapshot,
    loading,
    refreshing,
    refresh: () => load(true),
  };
}
