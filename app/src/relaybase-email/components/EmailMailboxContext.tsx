"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDomain } from "@/lib/dashboard/DomainContext";
import {
  fetchEmailCached,
  fetchEmailCachedOptional,
  clearEmailCache,
} from "@/relaybase-email/components/email-cached-fetch";
import type { EmailAccountFilter } from "@/relaybase-email/components/EmailAccountSelect";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import type {
  Address,
  EmailConfig,
  RoutingActivityEvent,
  SentEmail,
} from "@/relaybase-email/components/types";

type EmailMailboxContextValue = {
  config: EmailConfig | null;
  addresses: Address[];
  activity: RoutingActivityEvent[];
  sent: SentEmail[];
  accountFilter: EmailAccountFilter;
  setAccountFilter: (value: EmailAccountFilter) => void;
  inboxCount: number;
  sentCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  message: string | null;
  setMessage: (value: string | null) => void;
  refresh: (force?: boolean) => Promise<void>;
  relaybaseOk: boolean;
};

const EmailMailboxContext = createContext<EmailMailboxContextValue | null>(null);

export function EmailMailboxProvider({ children }: { children: ReactNode }) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { activeDomain, domainQuery } = useDomain();
  const domainKey = activeDomain ?? "none";

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [activity, setActivity] = useState<RoutingActivityEvent[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [accountFilter, setAccountFilter] = useState<EmailAccountFilter>("all");
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ messages?: RoutingActivityEvent[] }>(productId, "inbox") ===
        null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dataRef = useRef({ config, activity, sent });
  dataRef.current = { config, activity, sent };

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);
    const staleInbox = readEmailStale<{ messages?: RoutingActivityEvent[] }>(
      productId,
      "inbox",
    );
    if (staleInbox) setActivity(staleInbox.messages ?? []);
    const staleSent = readEmailStale<{ sent?: SentEmail[] }>(productId, "sent");
    if (staleSent) setSent(staleSent.sent ?? []);
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses",
    );
    if (staleAddresses) setAddresses(staleAddresses.addresses ?? []);
    if (staleConfig || staleInbox) setLoading(false);
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData =
        dataRef.current.config !== null ||
        dataRef.current.activity.length > 0 ||
        dataRef.current.sent.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [cfgResult, inboxResult, sentResult, addrResult] =
          await Promise.all([
            fetchEmailCached<EmailConfig>(productId, "config", `${apiBase}/config`, {
              refresh: force,
              onUpdate: (data) => setConfig(data),
            }),
            fetchEmailCachedOptional<{ messages?: RoutingActivityEvent[] }>(
              productId,
              `inbox:${domainKey}`,
              `${apiBase}/inbox${domainQuery({ limit: "100" })}`,
              {
                refresh: force,
                onUpdate: (data) => setActivity(data?.messages ?? []),
              },
            ),
            fetchEmailCachedOptional<{ sent?: SentEmail[] }>(
              productId,
              `sent:${domainKey}`,
              `${apiBase}/sent${domainQuery()}`,
              {
                refresh: force,
                onUpdate: (data) => setSent(data?.sent ?? []),
              },
            ),
            fetchEmailCachedOptional<{ addresses?: Address[] }>(
              productId,
              `addresses:${domainKey}`,
              `${apiBase}/addresses${domainQuery()}`,
              {
                refresh: force,
                onUpdate: (data) => setAddresses(data?.addresses ?? []),
              },
            ),
          ]);
        setConfig(cfgResult.data);
        if (inboxResult.ok) {
          setActivity(inboxResult.data?.messages ?? []);
        } else {
          setActivity([]);
          setError("Failed to load received mail from Relaybase");
        }
        if (sentResult.ok) setSent(sentResult.data?.sent ?? []);
        if (addrResult.ok) setAddresses(addrResult.data?.addresses ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, domainKey, domainQuery, productId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh, activeDomain]);

  useEffect(() => {
    setAccountFilter("all");
  }, [activeDomain]);

  useEffect(() => {
    if (
      accountFilter !== "all" &&
      !addresses.some((a) => a.email === accountFilter)
    ) {
      setAccountFilter("all");
    }
  }, [accountFilter, addresses]);

  useEffect(() => {
    function onUpdatesSynced() {
      clearEmailCache(productId, `inbox:${domainKey}`);
      void refresh(true);
    }

    window.addEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    return () => {
      window.removeEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    };
  }, [domainKey, productId, refresh]);

  const inboxCount = activity.length;
  const sentCount = sent.length;
  const relaybaseOk = config?.relaybaseConfigured ?? false;

  const value = useMemo(
    (): EmailMailboxContextValue => ({
      config,
      addresses,
      activity,
      sent,
      accountFilter,
      setAccountFilter,
      inboxCount,
      sentCount,
      loading,
      refreshing,
      error,
      setError,
      message,
      setMessage,
      refresh,
      relaybaseOk,
    }),
    [
      accountFilter,
      activity,
      addresses,
      config,
      error,
      inboxCount,
      loading,
      message,
      refresh,
      refreshing,
      relaybaseOk,
      sent,
      sentCount,
    ],
  );

  return (
    <EmailMailboxContext.Provider value={value}>
      {children}
    </EmailMailboxContext.Provider>
  );
}

export function useEmailMailbox() {
  const ctx = useContext(EmailMailboxContext);
  if (!ctx) {
    throw new Error("useEmailMailbox requires EmailMailboxProvider");
  }
  return ctx;
}
