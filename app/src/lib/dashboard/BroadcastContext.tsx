"use client";

import * as React from "react";
import { reaction } from "mobx";

import { useDashboardPaths } from "@/console/lib/paths";
import { BroadcastStore } from "@/lib/dashboard/broadcast-store";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";

const BroadcastStoreContext = React.createContext<BroadcastStore | null>(null);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const userId = useProductId();
  const { apiBase } = useDashboardPaths();
  const storeRef = React.useRef<BroadcastStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new BroadcastStore();
  }
  const store = storeRef.current;

  React.useEffect(() => {
    store.configure({ productId: userId, apiBase });
  }, [store, userId, apiBase]);

  React.useEffect(() => {
    void store.hydrate();
  }, [store, userId]);

  return (
    <BroadcastStoreContext.Provider value={store}>
      {children}
    </BroadcastStoreContext.Provider>
  );
}

export function useBroadcastStore(): BroadcastStore {
  const store = React.useContext(BroadcastStoreContext);
  if (!store) throw new Error("BroadcastProvider required");
  return store;
}

/**
 * MobX BroadcastStore with a React subscription so route changes keep the
 * same instance while components still re-render on observable updates.
 */
export function useBroadcast(): BroadcastStore {
  const store = useBroadcastStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        jobs: store.jobs.map((j) => [
          j.broadcastId,
          j.phase,
          j.error,
          j.message,
        ]),
        drafts: store.drafts.map((d) => [
          d.id,
          d.updatedAt,
          d.subject,
          d.from,
          d.body,
          d.groupIds.join(","),
        ]),
        hydrated: store.hydrated,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}

export { BroadcastStore } from "@/lib/dashboard/broadcast-store";
export type {
  BroadcastJob,
  BroadcastJobPhase,
} from "@/lib/dashboard/broadcast-store";
export type { LocalBroadcastDraft } from "@/lib/dashboard/broadcast-drafts-disk";
