"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  fetchTemplateSidebarList,
  getCachedTemplateSidebarList,
  getTemplateSidebarListSnapshot,
  subscribeTemplateSidebarList,
} from "@/studio/lib/templates/template-sidebar-list";

export function useTemplateSidebarList() {
  const rows = useSyncExternalStore(
    subscribeTemplateSidebarList,
    getTemplateSidebarListSnapshot,
    getTemplateSidebarListSnapshot,
  );

  const [hydrated, setHydrated] = useState(() => getCachedTemplateSidebarList() !== null);

  useEffect(() => {
    void fetchTemplateSidebarList(false).finally(() => setHydrated(true));
  }, []);

  const loading = !hydrated;

  const refresh = useCallback(async (force = true) => {
    return fetchTemplateSidebarList(force);
  }, []);

  return { rows, loading, refresh };
}
