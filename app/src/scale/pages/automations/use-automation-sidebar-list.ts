"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  fetchAutomationSidebarList,
  getAutomationSidebarListSnapshot,
  getCachedAutomationSidebarList,
  subscribeAutomationSidebarList,
} from "@/scale/lib/automation-sidebar-list";

export function useAutomationSidebarList() {
  const rows = useSyncExternalStore(
    subscribeAutomationSidebarList,
    getAutomationSidebarListSnapshot,
    getAutomationSidebarListSnapshot,
  );

  const [hydrated, setHydrated] = useState(() => getCachedAutomationSidebarList() !== null);

  useEffect(() => {
    void fetchAutomationSidebarList(false).finally(() => setHydrated(true));
  }, []);

  const loading = !hydrated;

  const refresh = useCallback(async (force = true) => {
    return fetchAutomationSidebarList(force);
  }, []);

  return {
    rows,
    /** True only before the first list is available. */
    loading,
    refresh,
  };
}
