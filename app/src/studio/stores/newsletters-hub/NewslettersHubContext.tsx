"use client";

import * as React from "react";
import { reaction } from "mobx";

import { NewslettersHubStore, newslettersHubStore } from "./newsletters-hub-store";

const NewslettersHubStoreContext = React.createContext<NewslettersHubStore | null>(null);

export function NewslettersHubProvider({ children }: { children: React.ReactNode }) {
  return (
    <NewslettersHubStoreContext.Provider value={newslettersHubStore}>
      {children}
    </NewslettersHubStoreContext.Provider>
  );
}

export function useNewslettersHubStore(): NewslettersHubStore {
  const store = React.useContext(NewslettersHubStoreContext);
  if (!store) {
    throw new Error("NewslettersHubProvider required");
  }
  return store;
}

/** MobX subscription for React re-renders. */
export function useNewslettersHub(): NewslettersHubStore {
  const store = useNewslettersHubStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        newsletters: store.newsletters.length,
        layouts: store.layouts.length,
        inProgress: store.inProgress !== null,
        sentOverview: store.sentOverview !== null,
        listFetching: store.listFetching,
        listLoadError: store.listLoadError,
        inProgressFetching: store.inProgressFetching,
        sentOverviewFetching: store.sentOverviewFetching,
        listShowPlaceholder: store.listShowPlaceholder,
        listRefreshing: store.listRefreshing,
        inProgressShowPlaceholder: store.inProgressShowPlaceholder,
        inProgressRefreshing: store.inProgressRefreshing,
        sentOverviewShowPlaceholder: store.sentOverviewShowPlaceholder,
        sentOverviewRefreshing: store.sentOverviewRefreshing,
        hasSending: store.hasSendingNewsletters,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}
