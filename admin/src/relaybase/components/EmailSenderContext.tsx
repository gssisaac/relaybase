"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cacheHintText,
  fetchCachedApi,
  type CacheMeta,
} from "@/lib/dashboard/shared/cached-fetch";
import {
  clearDashboardCache,
  readCachedOrStale,
} from "@/lib/dashboard/shared/dashboard-client-cache";
import { RELAYBASE_API } from "@/relaybase/components/constants";
import type {
  EmailSenderConfigStatus,
  EmailSenderKeyRow,
  EmailSenderLogEntry,
  EmailSenderLogSummary,
  EmailSenderSentEmail,
} from "@/relaybase/components/types";

export const RELAYBASE_CACHE_ID = "relaybase";

/** @deprecated Use RELAYBASE_CACHE_ID */
export const EMAIL_SENDER_CACHE_ID = RELAYBASE_CACHE_ID;
const CACHE_NS = "relaybase";

type ConfigPayload = EmailSenderConfigStatus;

type KeysPayload = { keys: EmailSenderKeyRow[] };

type SentPayload = { sent: EmailSenderSentEmail[] };

type LogsPayload = {
  summary?: EmailSenderLogSummary;
  logs?: EmailSenderLogEntry[];
};

type EmailSenderContextValue = {
  config: ConfigPayload | null;
  keys: EmailSenderKeyRow[];
  loading: boolean;
  refreshing: boolean;
  configMeta: CacheMeta | null;
  keysMeta: CacheMeta | null;
  error: string | null;
  message: string | null;
  setMessage: (message: string | null) => void;
  setError: (error: string | null) => void;
  refreshConfig: (options?: { refresh?: boolean }) => Promise<void>;
  refreshKeys: (options?: { refresh?: boolean }) => Promise<void>;
  fetchSent: (options?: {
    refresh?: boolean;
    onUpdate?: (data: SentPayload) => void;
  }) => Promise<{ data: SentPayload; meta: CacheMeta }>;
  fetchLogs: (
    queryKey: string,
    query: string,
    options?: {
      refresh?: boolean;
      onUpdate?: (data: LogsPayload) => void;
    },
  ) => Promise<{ data: LogsPayload; meta: CacheMeta }>;
  invalidateConfig: () => void;
};

const EmailSenderContext = createContext<EmailSenderContextValue | null>(null);

export function EmailSenderProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ConfigPayload | null>(() =>
    readCachedOrStale<ConfigPayload>(RELAYBASE_CACHE_ID, CACHE_NS, "config:v3"),
  );
  const [keys, setKeys] = useState<EmailSenderKeyRow[]>(() => {
    const cached = readCachedOrStale<KeysPayload>(
      RELAYBASE_CACHE_ID,
      CACHE_NS,
      "keys",
    );
    return cached?.keys ?? [];
  });
  const [loading, setLoading] = useState(() => config === null);
  const [refreshing, setRefreshing] = useState(false);
  const [configMeta, setConfigMeta] = useState<CacheMeta | null>(null);
  const [keysMeta, setKeysMeta] = useState<CacheMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshConfig = useCallback(async (options?: { refresh?: boolean }) => {
    const isRefresh = options?.refresh ?? false;
    setRefreshing(true);
    if (!isRefresh) {
      setLoading((prev) => {
        const hasCache = readCachedOrStale<ConfigPayload>(
          RELAYBASE_CACHE_ID,
          CACHE_NS,
          "config:v3",
        );
        return hasCache === null;
      });
    }
    setError(null);
    try {
      const configUrl = isRefresh
        ? `${RELAYBASE_API}/config?diagnostics=1`
        : `${RELAYBASE_API}/config`;
      const { data, meta } = await fetchCachedApi<ConfigPayload>(
        RELAYBASE_CACHE_ID,
        CACHE_NS,
        "config:v3",
        configUrl,
        {
          refresh: isRefresh,
          onUpdate: (next) => setConfig(next),
        },
      );
      setConfig(data);
      setConfigMeta(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshKeys = useCallback(async (options?: { refresh?: boolean }) => {
    if (!config?.workerLinked && !options?.refresh) {
      setKeys([]);
      return;
    }
    const isRefresh = options?.refresh ?? false;
    setRefreshing(true);
    setError(null);
    try {
      const { data, meta } = await fetchCachedApi<KeysPayload>(
        RELAYBASE_CACHE_ID,
        CACHE_NS,
        "keys",
        `${RELAYBASE_API}/keys`,
        {
          refresh: isRefresh,
          onUpdate: (next) => setKeys(next.keys ?? []),
        },
      );
      setKeys(data.keys ?? []);
      setKeysMeta(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setRefreshing(false);
    }
  }, [config?.workerLinked]);

  const fetchSent = useCallback(
    async (options?: {
      refresh?: boolean;
      onUpdate?: (data: SentPayload) => void;
    }) => {
      return fetchCachedApi<SentPayload>(
        RELAYBASE_CACHE_ID,
        CACHE_NS,
        "sent",
        `${RELAYBASE_API}/sent`,
        options,
      );
    },
    [],
  );

  const fetchLogs = useCallback(
    async (
      queryKey: string,
      query: string,
      options?: {
        refresh?: boolean;
        onUpdate?: (data: LogsPayload) => void;
      },
    ) => {
      return fetchCachedApi<LogsPayload>(
        RELAYBASE_CACHE_ID,
        CACHE_NS,
        `logs:${queryKey}`,
        `${RELAYBASE_API}/logs?${query}`,
        options,
      );
    },
    [],
  );

  const invalidateConfig = useCallback(() => {
    clearDashboardCache(RELAYBASE_CACHE_ID, CACHE_NS, "config:v3");
    clearDashboardCache(RELAYBASE_CACHE_ID, CACHE_NS, "keys");
  }, []);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    if (config?.workerLinked) void refreshKeys();
    else setKeys([]);
  }, [config?.workerLinked, refreshKeys]);

  const value = useMemo(
    () => ({
      config,
      keys,
      loading,
      refreshing,
      configMeta,
      keysMeta,
      error,
      message,
      setMessage,
      setError,
      refreshConfig,
      refreshKeys,
      fetchSent,
      fetchLogs,
      invalidateConfig,
    }),
    [
      config,
      keys,
      loading,
      refreshing,
      configMeta,
      keysMeta,
      error,
      message,
      refreshConfig,
      refreshKeys,
      fetchSent,
      fetchLogs,
      invalidateConfig,
    ],
  );

  return (
    <EmailSenderContext.Provider value={value}>
      {children}
    </EmailSenderContext.Provider>
  );
}

export function useEmailSender() {
  const ctx = useContext(EmailSenderContext);
  if (!ctx) {
    throw new Error("useEmailSender must be used within EmailSenderProvider");
  }
  return ctx;
}

export function useEmailSenderCacheHint(...metas: Array<CacheMeta | null>) {
  const meta = metas.find((m) => m?.fromCache) ?? null;
  return meta ? cacheHintText(meta.fromCache, meta.ageMinutes) : null;
}
