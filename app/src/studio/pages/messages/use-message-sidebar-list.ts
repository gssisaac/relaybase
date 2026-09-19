"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  fetchMessageSidebarList,
  getCachedMessageSidebarList,
  getMessageSidebarListSnapshot,
  subscribeMessageSidebarList,
} from "@/studio/lib/messages/message-sidebar-list";

export function useMessageSidebarList() {
  const rows = useSyncExternalStore(
    subscribeMessageSidebarList,
    getMessageSidebarListSnapshot,
    getMessageSidebarListSnapshot,
  );

  const [hydrated, setHydrated] = useState(() => getCachedMessageSidebarList() !== null);

  useEffect(() => {
    void fetchMessageSidebarList(false).finally(() => setHydrated(true));
  }, []);

  const loading = !hydrated;

  const refresh = useCallback(async (force = true) => {
    return fetchMessageSidebarList(force);
  }, []);

  return { rows, loading, refresh };
}
