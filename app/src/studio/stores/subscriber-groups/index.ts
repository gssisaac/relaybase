"use client";

import * as React from "react";
import { reaction } from "mobx";

export {
  SubscriberGroupsProvider,
  useSubscriberGroups,
  useSubscriberGroupsStore,
} from "./SubscriberGroupsContext";
export { SubscriberGroupsStore, subscriberGroupsStore } from "./subscriber-groups-store";

import { subscriberGroupsStore } from "./subscriber-groups-store";

/** MobX subscription without SubscriberGroupsProvider. */
export function useSubscriberGroupsSession() {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        dataEpoch: subscriberGroupsStore.dataEpoch,
        fetching: subscriberGroupsStore.fetching,
        showPlaceholder: subscriberGroupsStore.showPlaceholder,
        isRefreshing: subscriberGroupsStore.isRefreshing,
      }),
      () => setTick((t) => t + 1),
    );
  }, []);

  return subscriberGroupsStore;
}
