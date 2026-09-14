"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  audienceDetailFromSearch as defaultDetailFromSearch,
  type AudienceDetailTab,
} from "@/crm/lib/paths";

type AudienceRouteContextValue = {
  audienceRoot: string;
  audienceDetailHref: (groupId: string, tab?: AudienceDetailTab) => string;
  audienceDetailFromSearch: typeof defaultDetailFromSearch;
};

const defaultRoot = "/crm/audience";

function makeDetailHref(root: string, groupId: string, tab: AudienceDetailTab = "contacts") {
  const params = new URLSearchParams();
  params.set("id", groupId.trim());
  if (tab !== "contacts") params.set("tab", tab);
  return `${root}?${params.toString()}`;
}

const AudienceRouteContext = createContext<AudienceRouteContextValue>({
  audienceRoot: defaultRoot,
  audienceDetailHref: (groupId, tab) => makeDetailHref(defaultRoot, groupId, tab),
  audienceDetailFromSearch: defaultDetailFromSearch,
});

export function AudienceRouteProvider({
  audienceRoot,
  children,
}: {
  audienceRoot: string;
  children: ReactNode;
}) {
  const value = useMemo(
    (): AudienceRouteContextValue => ({
      audienceRoot,
      audienceDetailHref: (groupId, tab) => makeDetailHref(audienceRoot, groupId, tab),
      audienceDetailFromSearch: defaultDetailFromSearch,
    }),
    [audienceRoot],
  );
  return (
    <AudienceRouteContext.Provider value={value}>{children}</AudienceRouteContext.Provider>
  );
}

export function useAudienceRoutes() {
  return useContext(AudienceRouteContext);
}
