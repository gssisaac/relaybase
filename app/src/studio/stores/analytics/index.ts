"use client";

import * as React from "react";
import { reaction } from "mobx";

export { AnalyticsProvider, useAnalytics, useAnalyticsStore } from "./AnalyticsContext";
export { AnalyticsStore, analyticsStore } from "./analytics-store";
import { analyticsStore } from "./analytics-store";

/** MobX subscription without AnalyticsProvider (e.g. triggers list KPIs). */
export function useAnalyticsSession() {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        dataEpoch: analyticsStore.dataEpoch,
        fetching: analyticsStore.fetching,
        showPlaceholder: analyticsStore.showPlaceholder,
        isRefreshing: analyticsStore.isRefreshing,
      }),
      () => setTick((t) => t + 1),
    );
  }, []);

  return analyticsStore;
}
