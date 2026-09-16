"use client";

import * as React from "react";
import { reaction } from "mobx";

import { connectedCfAccountId } from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import { VerifiedAccountsStore } from "@/lib/scale/verified-accounts-store";

const VerifiedAccountsStoreContext = React.createContext<VerifiedAccountsStore | null>(
  null,
);

export function VerifiedAccountsProvider({ children }: { children: React.ReactNode }) {
  const desktop = useOptionalDesktop();
  const accountId = connectedCfAccountId(desktop?.credentials);
  const storeRef = React.useRef<VerifiedAccountsStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new VerifiedAccountsStore();
  }
  const store = storeRef.current;

  React.useEffect(() => {
    store.configure({ accountId });
  }, [store, accountId]);

  React.useEffect(() => {
    void store.refreshDestinations();
  }, [store, accountId]);

  React.useEffect(() => () => store.dispose(), [store]);

  return (
    <VerifiedAccountsStoreContext.Provider value={store}>
      {children}
    </VerifiedAccountsStoreContext.Provider>
  );
}

export function useVerifiedAccountsStore(): VerifiedAccountsStore {
  const store = React.useContext(VerifiedAccountsStoreContext);
  if (!store) {
    throw new Error("VerifiedAccountsProvider required");
  }
  return store;
}

/** MobX store subscription for React re-renders. */
export function useVerifiedAccounts(): VerifiedAccountsStore {
  const store = useVerifiedAccountsStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        size: store.destinationsByEmail.size,
        loading: store.loadingDestinations,
        error: store.destinationError,
        actionEmail: store.actionEmail,
        actionPhase: store.actionPhase,
        actionError: store.actionError,
        polling: store.destinationsByEmail.size,
        lastRefreshedAt: store.lastRefreshedAt,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}

export { VerifiedAccountsStore } from "@/lib/scale/verified-accounts-store";
export type { VerificationStatus } from "@/lib/scale/verified-accounts-store";
