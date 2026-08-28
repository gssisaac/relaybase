"use client";

import { useCallback, useEffect, useState } from "react";

import {
  dashboardCacheNeedsRefresh,
  loadDashboardCache,
  saveDashboardCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import {
  probeConnectionStatus,
  type ConnectionStatusSnapshot,
} from "@/lib/dashboard/connection-status";
import { useAppSession } from "@/lib/desktop/app-session";
import { useOptionalDesktop } from "@/lib/desktop/shell";

export const CONNECTION_STATUS_CACHE_KEY = "connection-status-v4";

export function useConnectionStatus() {
  const desktop = useOptionalDesktop();
  const session = useAppSession();
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
          cfConnected: false,
          cfInstallTokenPresent: Boolean(credentials?.installToken?.trim()),
          worker: null,
        });
      }

      const needsNetwork =
        force === true ||
        !cached?.data ||
        dashboardCacheNeedsRefresh(cached.fetchedAt) ||
        (session.hasConsoleAccess && !cached?.data?.worker);

      if (!needsNetwork) return;

      if (cached?.data) setRefreshing(true);
      else setLoading(true);

      try {
        const next = await probeConnectionStatus(credentials, {
          hasConsoleAccess: session.hasConsoleAccess,
        });
        setSnapshot(next);
        await saveDashboardCache(CONNECTION_STATUS_CACHE_KEY, next);
      } catch {
        const fallback: ConnectionStatusSnapshot = {
          cfConnected: false,
          cfInstallTokenPresent: Boolean(credentials?.installToken?.trim()),
          worker: null,
        };
        setSnapshot((prev) => prev ?? fallback);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [credentials, session.hasConsoleAccess],
  );

  useEffect(() => {
    if (session.hasConsoleAccess) {
      void load(true);
      return;
    }
    void load();
  }, [load, session.hasConsoleAccess]);

  return {
    snapshot,
    loading,
    refreshing,
    refresh: () => load(true),
  };
}
