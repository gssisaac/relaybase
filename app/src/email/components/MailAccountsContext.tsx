"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { reaction } from "mobx";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useEmailPaths } from "@/email/paths";
import { MailAccountsStore } from "@/email/mail-accounts-store";
import type { AccountColorMap } from "@/email/account-colors";
import type { Address } from "@/email/components/types";

type MailAccountsContextValue = {
  availableAddresses: Address[];
  enabledAccounts: string[];
  enabledAddresses: Address[];
  accountColors: AccountColorMap;
  getColor: (email: string) => string;
  loading: boolean;
  error: string | null;
  refreshAddresses: () => Promise<void>;
  addEnabledAccount: (email: string) => void;
  removeEnabledAccount: (email: string) => void;
  setEnabledAccounts: (emails: string[]) => void;
  /** Direct store access for observers / sync bridge. */
  store: MailAccountsStore;
};

const MailAccountsStoreContext = createContext<MailAccountsStore | null>(null);

export function MailAccountsProvider({ children }: { children: ReactNode }) {
  const userId = useProductId();
  const { apiBase } = useEmailPaths();
  const [store] = useState(() => new MailAccountsStore());

  useEffect(() => {
    store.configure({ userId, apiBase });
  }, [store, userId, apiBase]);

  useEffect(() => {
    store.start();
    return () => {
      store.stop();
    };
  }, [store]);

  return (
    <MailAccountsStoreContext.Provider value={store}>
      {children}
    </MailAccountsStoreContext.Provider>
  );
}

export function useMailAccountsStore(): MailAccountsStore {
  const store = useContext(MailAccountsStoreContext);
  if (!store) {
    throw new Error("useMailAccountsStore requires MailAccountsProvider");
  }
  return store;
}

export function useMailAccounts(): MailAccountsContextValue {
  const store = useMailAccountsStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    return reaction(
      () => ({
        available: store.availableAddresses.map((a) => a.email),
        enabled: store.enabledAccounts.slice(),
        colors: Object.keys(store.accountColors).length,
        loading: store.loading,
        error: store.error,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return {
    availableAddresses: store.availableAddresses,
    enabledAccounts: store.enabledAccounts,
    enabledAddresses: store.enabledAddresses,
    accountColors: store.accountColors,
    getColor: store.getColor,
    loading: store.loading,
    error: store.error,
    refreshAddresses: store.refreshAddresses,
    addEnabledAccount: store.addEnabledAccount,
    removeEnabledAccount: store.removeEnabledAccount,
    setEnabledAccounts: store.setEnabledAccounts,
    store,
  };
}

export function useAccountColor(email: string): string {
  const { getColor } = useMailAccounts();
  return getColor(email);
}
