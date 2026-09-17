"use client";

import * as React from "react";
import { reaction } from "mobx";

import { TriggersHubStore, triggersHubStore } from "./triggers-hub-store";

const TriggersHubStoreContext = React.createContext<TriggersHubStore | null>(null);

export function TriggersHubProvider({ children }: { children: React.ReactNode }) {
  return (
    <TriggersHubStoreContext.Provider value={triggersHubStore}>
      {children}
    </TriggersHubStoreContext.Provider>
  );
}

export function useTriggersHubStore(): TriggersHubStore {
  const store = React.useContext(TriggersHubStoreContext);
  if (!store) {
    throw new Error("TriggersHubProvider required");
  }
  return store;
}

export function useTriggersHub(): TriggersHubStore {
  const store = useTriggersHubStore();
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
