"use client";

import * as React from "react";
import { reaction } from "mobx";

import { AnalyticsStore, analyticsStore } from "./analytics-store";

const AnalyticsStoreContext = React.createContext<AnalyticsStore | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsStoreContext.Provider value={analyticsStore}>{children}</AnalyticsStoreContext.Provider>
  );
}

export function useAnalyticsStore(): AnalyticsStore {
  const store = React.useContext(AnalyticsStoreContext);
  if (!store) {
    throw new Error("AnalyticsProvider required");
  }
  return store;
}

/** MobX subscription for React re-renders (singleton on analytics page). */
export function useAnalytics(): AnalyticsStore {
  const store = useAnalyticsStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        dataEpoch: store.dataEpoch,
        fetching: store.fetching,
        loadError: store.loadError,
        showPlaceholder: store.showPlaceholder,
        isRefreshing: store.isRefreshing,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}
