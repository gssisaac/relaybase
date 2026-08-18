"use client";

import * as React from "react";
import { reaction } from "mobx";

import { AccountsStore } from "@/lib/dashboard/accounts-store";
import { useDomainStore } from "@/lib/dashboard/DomainContext";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDashboardPaths } from "@/dashboard/paths";

const AccountsStoreContext = React.createContext<AccountsStore | null>(null);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const userId = useProductId();
  const { apiBase } = useDashboardPaths();
  const domainStore = useDomainStore();
  const storeRef = React.useRef<AccountsStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new AccountsStore();
  }
  const store = storeRef.current;

  React.useEffect(() => {
    store.configure({ productId: userId, apiBase });
  }, [store, userId, apiBase]);

  // Domain seed goes through Dashboard AccountsStore so Email sync fires.
  React.useEffect(() => {
    domainStore.bindSeedAddresses((domain) => store.createDefaults(domain));
    return () => {
      domainStore.bindSeedAddresses(null);
    };
  }, [domainStore, store]);

  return (
    <AccountsStoreContext.Provider value={store}>
      {children}
    </AccountsStoreContext.Provider>
  );
}

export function useAccountsStore(): AccountsStore {
  const store = React.useContext(AccountsStoreContext);
  if (!store) throw new Error("AccountsProvider required");
  return store;
}

/**
 * MobX AccountsStore with a React subscription so non-observer components
 * re-render on observable updates.
 */
export function useAccounts(): AccountsStore {
  const store = useAccountsStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        domains: Object.keys(store.addressesByDomain).sort(),
        counts: Object.entries(store.addressesByDomain).map(([d, list]) => [
          d,
          list.length,
          list
            .map(
              (a) =>
                `${a.email}:${a.displayName ?? ""}:${a.inboundEnabled !== false}`,
            )
            .join(","),
        ]),
        fetchedAt: Object.entries(store.fetchedAtByDomain)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([d, at]) => [d, at]),
        addressCounts: Object.entries(store.countsByDomain)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([d, counts]) => [d, JSON.stringify(counts)]),
        loadingDomain: store.loadingDomain,
        refreshingDomain: store.refreshingDomain,
        countsLoadingDomain: store.countsLoadingDomain,
        saving: store.saving,
        error: store.error,
        message: store.message,
        inboundPending: store.inboundPendingEmails.slice(),
        creatingEmails: store.creatingEmails.slice(),
        mxConflictDomain: store.mxConflictDomain,
        mxConflicts: store.mxConflicts.slice(),
        mxResolving: store.mxResolving,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}

export { AccountsStore } from "@/lib/dashboard/accounts-store";
export type { CreateAddressesInput } from "@/lib/dashboard/accounts-store";
