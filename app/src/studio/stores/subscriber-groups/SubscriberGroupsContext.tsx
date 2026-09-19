"use client";

import * as React from "react";
import { reaction } from "mobx";

import {
  SubscriberGroupsStore,
  subscriberGroupsStore,
} from "./subscriber-groups-store";

const SubscriberGroupsStoreContext = React.createContext<SubscriberGroupsStore | null>(null);

export function SubscriberGroupsProvider({ children }: { children: React.ReactNode }) {
  return (
    <SubscriberGroupsStoreContext.Provider value={subscriberGroupsStore}>
      {children}
    </SubscriberGroupsStoreContext.Provider>
  );
}

export function useSubscriberGroupsStore(): SubscriberGroupsStore {
  const store = React.useContext(SubscriberGroupsStoreContext);
  if (!store) {
    throw new Error("SubscriberGroupsProvider required");
  }
  return store;
}

/** MobX subscription for React re-renders on the subscribers route. */
export function useSubscriberGroups(): SubscriberGroupsStore {
  const store = useSubscriberGroupsStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        dataEpoch: store.dataEpoch,
        emailsEpoch: store.emailsEpoch,
        fetching: store.fetching,
        emailsFetching: store.emailsFetching,
        loadError: store.loadError,
        showPlaceholder: store.showPlaceholder,
        isRefreshing: store.isRefreshing,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}
