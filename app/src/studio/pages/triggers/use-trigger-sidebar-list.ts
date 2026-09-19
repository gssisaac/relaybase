"use client";

import { useCallback, useEffect } from "react";

import { useTriggersHubSession } from "@/studio/stores/triggers-hub";

export function useTriggerSidebarList() {
  const hub = useTriggersHubSession();

  useEffect(() => {
    void hub.ensureLoaded();
  }, [hub]);

  const loading = hub.showPlaceholder;

  const refresh = useCallback(async (force = true) => {
    await hub.refresh({ force });
    return hub.sidebarRows;
  }, [hub]);

  return {
    rows: hub.sidebarRows,
    loading,
    refresh,
  };
}
