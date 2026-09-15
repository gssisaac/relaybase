"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  fetchTriggerSidebarList,
  getTriggerSidebarListSnapshot,
  getCachedTriggerSidebarList,
  subscribeTriggerSidebarList,
} from "@/scale/lib/triggers/trigger-sidebar-list";

export function useTriggerSidebarList() {
  const rows = useSyncExternalStore(
    subscribeTriggerSidebarList,
    getTriggerSidebarListSnapshot,
    getTriggerSidebarListSnapshot,
  );

  const [hydrated, setHydrated] = useState(() => getCachedTriggerSidebarList() !== null);

  useEffect(() => {
    void fetchTriggerSidebarList(false).finally(() => setHydrated(true));
  }, []);

  const loading = !hydrated;

  const refresh = useCallback(async (force = true) => {
    return fetchTriggerSidebarList(force);
  }, []);

  return {
    rows,
    /** True only before the first list is available. */
    loading,
    refresh,
  };
}
