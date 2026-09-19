"use client";

import * as React from "react";
import { reaction } from "mobx";

export { TriggersHubProvider, useTriggersHub, useTriggersHubStore } from "./TriggersHubContext";
export { TriggersHubStore, triggersHubStore } from "./triggers-hub-store";

import { triggersHubStore } from "./triggers-hub-store";

export function useTriggersHubSession() {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        dataEpoch: triggersHubStore.dataEpoch,
        fetching: triggersHubStore.fetching,
        showPlaceholder: triggersHubStore.showPlaceholder,
        isRefreshing: triggersHubStore.isRefreshing,
      }),
      () => setTick((t) => t + 1),
    );
  }, []);

  return triggersHubStore;
}
