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

import { useAppSession } from "@/lib/desktop/app-session";
import {
  desktopAwareFetch,
  readResponseJson,
  teamWorkerFetch,
} from "@/lib/desktop/api";
import {
  isSendingWarningStatus,
  statusForDomain,
  statusForEmail,
  type SendingHealthDomain,
  type SendingHealthSnapshot,
} from "@/lib/dashboard/sending-health";
import { formatWorkerApiError } from "@/lib/dashboard/worker-api-error";

export type SendingHealthApi = {
  snapshot: SendingHealthSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  statusForDomain: (domain: string) => SendingHealthDomain | null;
  statusForEmail: (email: string) => SendingHealthDomain | null;
  hasWarningForEmail: (email: string) => boolean;
  hasWarningForDomain: (domain: string) => boolean;
};

const SendingHealthContext = createContext<SendingHealthApi | null>(null);

async function fetchSendingHealth(team: boolean): Promise<SendingHealthSnapshot> {
  const res = team
    ? await teamWorkerFetch("/mobile/sending-health")
    : await desktopAwareFetch("/api/email/sending-health");
  if (!res.ok) {
    const body = await readResponseJson<{ error?: string }>(res).catch(
      () => ({ error: undefined as string | undefined }),
    );
    throw new Error(
      formatWorkerApiError(res.status, body.error, "Sending health"),
    );
  }
  return readResponseJson<SendingHealthSnapshot>(res);
}

export function SendingHealthProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const session = useAppSession();
  const isTeam = session.phase.kind === "invitedReady";
  const canFetch =
    enabled && (session.phase.kind === "ownerReady" || isTeam);

  const [snapshot, setSnapshot] = useState<SendingHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(canFetch);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force?: boolean) => {
      if (!canFetch) {
        setSnapshot(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!force) setLoading(true);
      else setRefreshing(true);
      try {
        const next = await fetchSendingHealth(isTeam);
        setSnapshot(next);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sending health",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canFetch, isTeam],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<SendingHealthApi>(
    () => ({
      snapshot,
      loading,
      refreshing,
      error,
      refresh: () => load(true),
      statusForDomain: (domain) => statusForDomain(snapshot, domain),
      statusForEmail: (email) => statusForEmail(snapshot, email),
      hasWarningForEmail: (email) =>
        isSendingWarningStatus(statusForEmail(snapshot, email)?.status),
      hasWarningForDomain: (domain) =>
        isSendingWarningStatus(statusForDomain(snapshot, domain)?.status),
    }),
    [error, load, loading, refreshing, snapshot],
  );

  return (
    <SendingHealthContext.Provider value={value}>
      {children}
    </SendingHealthContext.Provider>
  );
}

export function useSendingHealth(): SendingHealthApi {
  const ctx = useContext(SendingHealthContext);
  if (!ctx) throw new Error("SendingHealthProvider required");
  return ctx;
}
