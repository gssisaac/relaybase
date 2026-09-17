"use client";

import * as React from "react";
import { reaction } from "mobx";

import { DashboardStore, dashboardStore } from "./dashboard-store";

const DashboardStoreContext = React.createContext<DashboardStore | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => () => dashboardStore.dispose(), []);

  return (
    <DashboardStoreContext.Provider value={dashboardStore}>{children}</DashboardStoreContext.Provider>
  );
}

export function useDashboardStore(): DashboardStore {
  const store = React.useContext(DashboardStoreContext);
  if (!store) {
    throw new Error("DashboardProvider required");
  }
  return store;
}

/** MobX subscription for React re-renders. */
export function useDashboard(): DashboardStore {
  const store = useDashboardStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        data: store.data,
        fetching: store.fetching,
        loadError: store.loadError,
        showPlaceholder: store.showPlaceholder,
        isRefreshing: store.isRefreshing,
        hasSending: store.hasSending,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}
