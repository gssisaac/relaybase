"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useEmailPaths } from "@/email/paths";
import {
  ensureAccountColors,
  getAccountColor,
  type AccountColorMap,
} from "@/email/account-colors";
import { loadEmailPrefs, saveEmailPrefs } from "@/email/email-prefs";
import {
  readEnabledAccounts,
  sortAddressesByLocalPart,
  writeEnabledAccounts,
} from "@/email/enabled-accounts";
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
};

const MailAccountsContext = createContext<MailAccountsContextValue | null>(
  null,
);

export function MailAccountsProvider({ children }: { children: ReactNode }) {
  const userId = useProductId();
  const { apiBase } = useEmailPaths();
  const [availableAddresses, setAvailableAddresses] = useState<Address[]>([]);
  const [enabledAccounts, setEnabledAccountsState] = useState<string[]>([]);
  const [accountColors, setAccountColors] = useState<AccountColorMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    setEnabledAccountsState(readEnabledAccounts(userId));
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = await loadEmailPrefs();
      if (cancelled) return;
      setAccountColors(prefs.accountColors);
      setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistColors = useCallback(async (colors: AccountColorMap) => {
    setAccountColors(colors);
    await saveEmailPrefs({ version: 1, accountColors: colors });
  }, []);

  // Assign colors for newly enabled accounts once prefs are loaded.
  useEffect(() => {
    if (!prefsReady || !hydrated) return;
    const { nextMap, changed } = ensureAccountColors(
      enabledAccounts,
      accountColors,
    );
    if (changed) {
      void persistColors(nextMap);
    }
  }, [
    accountColors,
    enabledAccounts,
    hydrated,
    persistColors,
    prefsReady,
  ]);

  const setEnabledAccounts = useCallback(
    (emails: string[]) => {
      const next = [...new Set(emails)];
      setEnabledAccountsState(next);
      writeEnabledAccounts(userId, next);
    },
    [userId],
  );

  const addEnabledAccount = useCallback(
    (email: string) => {
      setEnabledAccountsState((prev) => {
        if (prev.includes(email)) return prev;
        const next = [...prev, email];
        writeEnabledAccounts(userId, next);
        return next;
      });
    },
    [userId],
  );

  const removeEnabledAccount = useCallback(
    (email: string) => {
      setEnabledAccountsState((prev) => {
        const next = prev.filter((item) => item !== email);
        writeEnabledAccounts(userId, next);
        return next;
      });
    },
    [userId],
  );

  const refreshAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/addresses?all=1`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        addresses?: Address[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load addresses");
      }
      setAvailableAddresses(data.addresses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  useEffect(() => {
    if (!hydrated || loading || error) return;
    if (availableAddresses.length === 0) return;
    const valid = new Set(
      availableAddresses.map((a) => a.email.toLowerCase()),
    );
    const next = enabledAccounts.filter((email) =>
      valid.has(email.toLowerCase()),
    );
    if (next.length !== enabledAccounts.length) {
      setEnabledAccounts(next);
    }
  }, [
    availableAddresses,
    enabledAccounts,
    error,
    hydrated,
    loading,
    setEnabledAccounts,
  ]);

  const enabledAddresses = useMemo(() => {
    const enabled = new Set(enabledAccounts.map((e) => e.toLowerCase()));
    return sortAddressesByLocalPart(
      availableAddresses.filter((a) => enabled.has(a.email.toLowerCase())),
    );
  }, [availableAddresses, enabledAccounts]);

  const getColor = useCallback(
    (email: string) => getAccountColor(email, accountColors),
    [accountColors],
  );

  const value = useMemo(
    (): MailAccountsContextValue => ({
      availableAddresses,
      enabledAccounts,
      enabledAddresses,
      accountColors,
      getColor,
      loading,
      error,
      refreshAddresses,
      addEnabledAccount,
      removeEnabledAccount,
      setEnabledAccounts,
    }),
    [
      accountColors,
      addEnabledAccount,
      availableAddresses,
      enabledAccounts,
      enabledAddresses,
      error,
      getColor,
      loading,
      refreshAddresses,
      removeEnabledAccount,
      setEnabledAccounts,
    ],
  );

  return (
    <MailAccountsContext.Provider value={value}>
      {children}
    </MailAccountsContext.Provider>
  );
}

export function useMailAccounts() {
  const ctx = useContext(MailAccountsContext);
  if (!ctx) {
    throw new Error("useMailAccounts requires MailAccountsProvider");
  }
  return ctx;
}

export function useAccountColor(email: string): string {
  const { getColor } = useMailAccounts();
  return getColor(email);
}
