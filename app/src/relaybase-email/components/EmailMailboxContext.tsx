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
import {
  EMAIL_SEND_FAILED,
  EMAIL_SEND_STARTED,
  EMAIL_SEND_SUCCEEDED,
} from "@/relaybase-email/components/email-send-events";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import type {
  Address,
  EmailConfig,
  RoutingActivityEvent,
  SentEmail,
} from "@/relaybase-email/components/types";

const OPEN_ACCOUNTS_KEY = "relaybase:mailbox-open-accounts";

function readStoredOpenAccounts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(OPEN_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredOpenAccounts(value: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OPEN_ACCOUNTS_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

type EmailMailboxContextValue = {
  config: EmailConfig | null;
  addresses: Address[];
  activity: RoutingActivityEvent[];
  sent: SentEmail[];
  accountFilter: EmailAccountFilter;
  setAccountFilter: (value: EmailAccountFilter) => void;
  openAccounts: string[];
  setOpenAccounts: (
    value: string[] | ((prev: string[]) => string[]),
  ) => void;
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
  const { activeDomain, domainQuery, loading: domainLoading } = useDomain();
  const domainKey = activeDomain ?? "none";

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [activity, setActivity] = useState<RoutingActivityEvent[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [accountFilter, setAccountFilter] = useState<EmailAccountFilter>("all");
  const [openAccounts, setOpenAccountsState] = useState<string[]>(
    readStoredOpenAccounts,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const setOpenAccounts = useCallback(
    (value: string[] | ((prev: string[]) => string[])) => {
      setOpenAccountsState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        writeStoredOpenAccounts(next);
        return next;
      });
    },
    [],
  );

  const dataRef = useRef({ config, activity, sent });
  dataRef.current = { config, activity, sent };
  const refreshGeneration = useRef(0);

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);

    if (activeDomain) {
      const staleInbox = readEmailStale<{ messages?: RoutingActivityEvent[] }>(
        productId,
        `inbox:${domainKey}`,
      );
      // Skip hydrating empty inbox — it forces a network refetch next.
      if ((staleInbox?.messages?.length ?? 0) > 0) {
        setActivity(staleInbox!.messages ?? []);
      }
      const staleSent = readEmailStale<{ sent?: SentEmail[] }>(
        productId,
        `sent:${domainKey}`,
      );
      if (staleSent) setSent(staleSent.sent ?? []);
      const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
        productId,
        `addresses:${domainKey}`,
      );
      if (staleAddresses) setAddresses(staleAddresses.addresses ?? []);
      if (staleConfig || (staleInbox?.messages?.length ?? 0) > 0) {
        setLoading(false);
      }
    } else if (staleConfig) {
      setLoading(false);
    }
  }, [productId, activeDomain, domainKey]);

  const refresh = useCallback(
    async (force?: boolean) => {
      // Wait for DomainProvider — do not fetch inbox:none or wipe the list.
      if (domainLoading) return;
      if (!activeDomain) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const generation = ++refreshGeneration.current;
      const hasData =
        dataRef.current.config !== null ||
        dataRef.current.activity.length > 0 ||
        dataRef.current.sent.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);

      // Inbox changes out-of-band (Worker inbound); never trust a long-lived cache hit.
      const forceInbox = true;

      try {
        const [cfgResult, inboxResult, sentResult, addrResult] =
          await Promise.all([
            fetchEmailCached<EmailConfig>(productId, "config", `${apiBase}/config`, {
              refresh: force,
              onUpdate: (data) => {
                if (refreshGeneration.current === generation) setConfig(data);
              },
            }),
            fetchEmailCachedOptional<{ messages?: RoutingActivityEvent[] }>(
              productId,
              `inbox:${domainKey}`,
              `${apiBase}/inbox${domainQuery({ limit: "100" })}`,
              {
                refresh: forceInbox,
                onUpdate: (data) => {
                  if (refreshGeneration.current === generation) {
                    setActivity(data?.messages ?? []);
                  }
                },
              },
            ),
            fetchEmailCachedOptional<{ sent?: SentEmail[] }>(
              productId,
              `sent:${domainKey}`,
              `${apiBase}/sent${domainQuery()}`,
              {
                refresh: force,
                onUpdate: (data) => {
                  if (refreshGeneration.current === generation) {
                    setSent(data?.sent ?? []);
                  }
                },
              },
            ),
            fetchEmailCachedOptional<{ addresses?: Address[] }>(
              productId,
              `addresses:${domainKey}`,
              `${apiBase}/addresses${domainQuery()}`,
              {
                refresh: force,
                onUpdate: (data) => {
                  if (refreshGeneration.current === generation) {
                    setAddresses(data?.addresses ?? []);
                  }
                },
              },
            ),
          ]);

        if (refreshGeneration.current !== generation) return;

        setConfig(cfgResult.data);
        if (inboxResult.ok) {
          setActivity(inboxResult.data?.messages ?? []);
        } else {
          setError("Failed to load received mail from Relaybase");
        }
        if (sentResult.ok) setSent(sentResult.data?.sent ?? []);
        if (addrResult.ok) setAddresses(addrResult.data?.addresses ?? []);
      } catch (e) {
        if (refreshGeneration.current === generation) {
          setError(e instanceof Error ? e.message : "Refresh failed");
        }
      } finally {
        if (refreshGeneration.current === generation) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeDomain, apiBase, domainKey, domainLoading, domainQuery, productId],
  );

  useEffect(() => {
    if (domainLoading) return;
    void refresh();
  }, [refresh, activeDomain, domainLoading]);

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
      if (!activeDomain) return;
      clearEmailCache(productId, `inbox:${domainKey}`);
      void refresh(true);
    }

    window.addEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    return () => {
      window.removeEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    };
  }, [activeDomain, domainKey, productId, refresh]);

  useEffect(() => {
    function onSendStarted() {
      setError(null);
      setMessage("Sending…");
    }

    function onSendSucceeded() {
      setError(null);
      setMessage("Email sent");
      clearEmailCache(productId, `sent:${domainKey}`);
      void refresh(true);
    }

    function onSendFailed(event: Event) {
      const detail = (event as CustomEvent<{ error?: string }>).detail;
      setMessage(null);
      setError(detail?.error || "Send failed");
    }

    window.addEventListener(EMAIL_SEND_STARTED, onSendStarted);
    window.addEventListener(EMAIL_SEND_SUCCEEDED, onSendSucceeded);
    window.addEventListener(EMAIL_SEND_FAILED, onSendFailed);
    return () => {
      window.removeEventListener(EMAIL_SEND_STARTED, onSendStarted);
      window.removeEventListener(EMAIL_SEND_SUCCEEDED, onSendSucceeded);
      window.removeEventListener(EMAIL_SEND_FAILED, onSendFailed);
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
      openAccounts,
      setOpenAccounts,
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
      openAccounts,
      refresh,
      refreshing,
      relaybaseOk,
      sent,
      sentCount,
      setOpenAccounts,
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
