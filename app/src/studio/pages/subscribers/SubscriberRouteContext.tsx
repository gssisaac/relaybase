"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  subscriberDetailFromSearch as defaultDetailFromSearch,
  type SubscriberDetailTab,
} from "@/studio/lib/paths";

type SubscriberRouteContextValue = {
  subscribersRoot: string;
  subscriberDetailHref: (groupId: string, tab?: SubscriberDetailTab) => string;
  subscriberDetailFromSearch: typeof defaultDetailFromSearch;
};

const defaultRoot = "/studio/subscribers";

function makeDetailHref(root: string, groupId: string, tab: SubscriberDetailTab = "contacts") {
  const params = new URLSearchParams();
  params.set("id", groupId.trim());
  if (tab !== "contacts") params.set("tab", tab);
  return `${root}?${params.toString()}`;
}

const SubscriberRouteContext = createContext<SubscriberRouteContextValue>({
  subscribersRoot: defaultRoot,
  subscriberDetailHref: (groupId, tab) => makeDetailHref(defaultRoot, groupId, tab),
  subscriberDetailFromSearch: defaultDetailFromSearch,
});

export function SubscriberRouteProvider({
  subscribersRoot,
  children,
}: {
  subscribersRoot: string;
  children: ReactNode;
}) {
  const value = useMemo(
    (): SubscriberRouteContextValue => ({
      subscribersRoot,
      subscriberDetailHref: (groupId, tab) => makeDetailHref(subscribersRoot, groupId, tab),
      subscriberDetailFromSearch: defaultDetailFromSearch,
    }),
    [subscribersRoot],
  );
  return (
    <SubscriberRouteContext.Provider value={value}>{children}</SubscriberRouteContext.Provider>
  );
}

export function useSubscriberRoutes() {
  return useContext(SubscriberRouteContext);
}
