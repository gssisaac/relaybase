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
import { useMailAccounts } from "@/email/components/MailAccountsContext";
import {
  fetchEmailCached,
  fetchEmailCachedOptional,
  clearEmailCache,
} from "@/email/components/email-cached-fetch";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import {
  EMAIL_SEND_FAILED,
  EMAIL_SEND_STARTED,
  EMAIL_SEND_SUCCEEDED,
} from "@/email/components/email-send-events";
import { useEmailPaths } from "@/email/paths";
import {
  readTrash,
  trashEntryKey,
  writeTrash,
  type TrashEntry,
  type TrashKind,
} from "@/email/trash-store";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import type {
  Address,
  EmailConfig,
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/types";

function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

function domainQuery(domain: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ domain, ...(extra ?? {}) });
  return `?${params.toString()}`;
}

type EmailMailboxContextValue = {
  config: EmailConfig | null;
  addresses: Address[];
  activity: RoutingActivityEvent[];
  sent: SentEmail[];
  trash: TrashEntry[];
  trashedActivity: RoutingActivityEvent[];
  trashedSent: SentEmail[];
  accountFilter: EmailAccountFilter;
  setAccountFilter: (value: EmailAccountFilter) => void;
  openAccounts: string[];
  setOpenAccounts: (
    value: string[] | ((prev: string[]) => string[]),
  ) => void;
  inboxCount: number;
  sentCount: number;
  trashCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  message: string | null;
  setMessage: (value: string | null) => void;
  refresh: (force?: boolean) => Promise<void>;
  moveToTrash: (kind: TrashKind, id: string) => void;
  restoreFromTrash: (kind: TrashKind, id: string) => void;
  emptyTrash: () => void;
  relaybaseOk: boolean;
};

const EmailMailboxContext = createContext<EmailMailboxContextValue | null>(
  null,
);

export function EmailMailboxProvider({ children }: { children: ReactNode }) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { enabledAddresses, enabledAccounts } = useMailAccounts();

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [activity, setActivity] = useState<RoutingActivityEvent[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [accountFilter, setAccountFilter] = useState<EmailAccountFilter>("all");
  const [openAccounts, setOpenAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [trash, setTrash] = useState<TrashEntry[]>([]);

  const dataRef = useRef({ config, activity, sent });
  dataRef.current = { config, activity, sent };
  const refreshGeneration = useRef(0);

  useEffect(() => {
    setTrash(readTrash(productId));
  }, [productId]);

  const domainsKey = useMemo(() => {
    const domains = new Set(
      enabledAddresses.map((a) => domainOf(a.email)).filter(Boolean),
    );
    return [...domains].sort().join("\0");
  }, [enabledAddresses]);

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) {
      setConfig(staleConfig);
      setLoading(false);
    }
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const generation = ++refreshGeneration.current;
      const hasData =
        dataRef.current.config !== null ||
        dataRef.current.activity.length > 0 ||
        dataRef.current.sent.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);

      const domains = domainsKey ? domainsKey.split("\0") : [];

      try {
        const cfgResult = await fetchEmailCached<EmailConfig>(
          productId,
          "config",
          `${apiBase}/config`,
          {
            refresh: force,
            onUpdate: (data) => {
              if (refreshGeneration.current === generation) setConfig(data);
            },
          },
        );

        const addrResult = await fetchEmailCachedOptional<{
          addresses?: Address[];
        }>(productId, "addresses:all", `${apiBase}/addresses?all=1`, {
          refresh: force,
          onUpdate: (data) => {
            if (refreshGeneration.current === generation) {
              setAddresses(data?.addresses ?? []);
            }
          },
        });

        const inboxResults = await Promise.all(
          domains.map((domain) =>
            fetchEmailCachedOptional<{ messages?: RoutingActivityEvent[] }>(
              productId,
              `inbox:${domain}`,
              `${apiBase}/inbox${domainQuery(domain, { limit: "100" })}`,
              { refresh: true },
            ),
          ),
        );

        const sentResults = await Promise.all(
          domains.map((domain) =>
            fetchEmailCachedOptional<{ sent?: SentEmail[] }>(
              productId,
              `sent:${domain}`,
              `${apiBase}/sent${domainQuery(domain)}`,
              { refresh: force },
            ),
          ),
        );

        if (refreshGeneration.current !== generation) return;

        setConfig(cfgResult.data);
        if (addrResult.ok) setAddresses(addrResult.data?.addresses ?? []);

        const mergedInbox: RoutingActivityEvent[] = [];
        let inboxFailed = false;
        for (const result of inboxResults) {
          if (!result.ok) {
            inboxFailed = true;
            continue;
          }
          mergedInbox.push(...(result.data?.messages ?? []));
        }
        // Dedupe by key
        const inboxByKey = new Map<string, RoutingActivityEvent>();
        for (const msg of mergedInbox) inboxByKey.set(msg.key, msg);
        setActivity([...inboxByKey.values()]);
        if (inboxFailed && domains.length > 0) {
          setError("Failed to load received mail from Relaybase");
        }

        const mergedSent: SentEmail[] = [];
        for (const result of sentResults) {
          if (result.ok) mergedSent.push(...(result.data?.sent ?? []));
        }
        const sentById = new Map<string, SentEmail>();
        for (const msg of mergedSent) sentById.set(msg.id, msg);
        setSent([...sentById.values()]);
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
    [apiBase, domainsKey, productId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (
      accountFilter !== "all" &&
      !enabledAccounts.some(
        (email) => email.toLowerCase() === accountFilter.toLowerCase(),
      )
    ) {
      setAccountFilter("all");
    }
  }, [accountFilter, enabledAccounts]);

  useEffect(() => {
    function onUpdatesSynced() {
      for (const domain of domainsKey ? domainsKey.split("\0") : []) {
        clearEmailCache(productId, `inbox:${domain}`);
      }
      void refresh(true);
    }

    window.addEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    return () => {
      window.removeEventListener(
        "ops-dashboard:updates-synced",
        onUpdatesSynced,
      );
    };
  }, [domainsKey, productId, refresh]);

  useEffect(() => {
    function onSendStarted() {
      setError(null);
      setMessage("Sending…");
    }

    function onSendSucceeded() {
      setError(null);
      setMessage("Email sent");
      for (const domain of domainsKey ? domainsKey.split("\0") : []) {
        clearEmailCache(productId, `sent:${domain}`);
      }
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
  }, [domainsKey, productId, refresh]);

  const enabledSet = useMemo(
    () => new Set(enabledAccounts.map((e) => e.toLowerCase())),
    [enabledAccounts],
  );

  const visibleAddresses = useMemo(
    () =>
      enabledAddresses.length > 0
        ? enabledAddresses
        : addresses.filter((a) => enabledSet.has(a.email.toLowerCase())),
    [addresses, enabledAddresses, enabledSet],
  );

  const trashKeys = useMemo(
    () => new Set(trash.map((entry) => trashEntryKey(entry.kind, entry.id))),
    [trash],
  );

  const enabledActivity = useMemo(() => {
    if (enabledSet.size === 0) return [];
    return activity.filter((m) => enabledSet.has(m.toEmail.toLowerCase()));
  }, [activity, enabledSet]);

  const enabledSent = useMemo(() => {
    if (enabledSet.size === 0) return [];
    return sent.filter((m) => enabledSet.has(m.from.toLowerCase()));
  }, [enabledSet, sent]);

  const visibleActivity = useMemo(
    () =>
      enabledActivity.filter(
        (m) => !trashKeys.has(trashEntryKey("inbox", m.key)),
      ),
    [enabledActivity, trashKeys],
  );

  const visibleSent = useMemo(
    () =>
      enabledSent.filter((m) => !trashKeys.has(trashEntryKey("sent", m.id))),
    [enabledSent, trashKeys],
  );

  const trashedActivity = useMemo(
    () =>
      enabledActivity.filter((m) =>
        trashKeys.has(trashEntryKey("inbox", m.key)),
      ),
    [enabledActivity, trashKeys],
  );

  const trashedSent = useMemo(
    () =>
      enabledSent.filter((m) => trashKeys.has(trashEntryKey("sent", m.id))),
    [enabledSent, trashKeys],
  );

  const moveToTrash = useCallback(
    (kind: TrashKind, id: string) => {
      setTrash((prev) => {
        if (prev.some((entry) => entry.kind === kind && entry.id === id)) {
          return prev;
        }
        const next = [
          ...prev,
          { kind, id, trashedAt: new Date().toISOString() },
        ];
        writeTrash(productId, next);
        return next;
      });
      setMessage("Moved to Trash");
    },
    [productId],
  );

  const restoreFromTrash = useCallback(
    (kind: TrashKind, id: string) => {
      setTrash((prev) => {
        const next = prev.filter(
          (entry) => !(entry.kind === kind && entry.id === id),
        );
        writeTrash(productId, next);
        return next;
      });
      setMessage("Restored from Trash");
    },
    [productId],
  );

  const emptyTrash = useCallback(() => {
    setTrash([]);
    writeTrash(productId, []);
    setMessage("Trash emptied");
  }, [productId]);

  const inboxCount = visibleActivity.length;
  const sentCount = visibleSent.length;
  const trashCount = trashedActivity.length + trashedSent.length;
  const relaybaseOk = config?.relaybaseConfigured ?? false;

  const value = useMemo(
    (): EmailMailboxContextValue => ({
      config,
      addresses: visibleAddresses,
      activity: visibleActivity,
      sent: visibleSent,
      trash,
      trashedActivity,
      trashedSent,
      accountFilter,
      setAccountFilter,
      openAccounts,
      setOpenAccounts,
      inboxCount,
      sentCount,
      trashCount,
      loading,
      refreshing,
      error,
      setError,
      message,
      setMessage,
      refresh,
      moveToTrash,
      restoreFromTrash,
      emptyTrash,
      relaybaseOk,
    }),
    [
      accountFilter,
      config,
      emptyTrash,
      error,
      inboxCount,
      loading,
      message,
      moveToTrash,
      openAccounts,
      refresh,
      refreshing,
      relaybaseOk,
      restoreFromTrash,
      sentCount,
      trash,
      trashCount,
      trashedActivity,
      trashedSent,
      visibleActivity,
      visibleAddresses,
      visibleSent,
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
