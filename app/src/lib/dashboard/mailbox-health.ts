"use client";

import { useCallback, useEffect, useState } from "react";

import { useOptionalDesktop } from "@/lib/desktop/shell";
import type { DesktopCredentials } from "@/lib/desktop/bridge";

export type MailboxHealthDomain = {
  domain: string;
  inbound: { lastAt: string | null; count: number; stale: boolean };
  sent: { lastAt: string | null; count: number };
};

export type MailboxHealthSnapshot = {
  d1Configured: boolean;
  r2Configured: boolean;
  generatedAt: string;
  staleDaysThreshold: number;
  totalDomains: number;
  staleDomains: number;
  totalInbound: number;
  totalSent: number;
  domains: MailboxHealthDomain[];
};

export type MailboxHealthResult = {
  snapshot: MailboxHealthSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Fetch `GET /console/mailbox-health` directly from the Worker (admin-token
 * bearer). Used by the Domains / Accounts pages to surface per-domain last
 * inbound and flag stale receive (the `wedesk.so` silent-receive case).
 * Returns a null snapshot when the Worker/D1 is not configured yet.
 */
export async function fetchMailboxHealth(
  credentials: DesktopCredentials | null | undefined,
  staleDays = 1,
): Promise<MailboxHealthSnapshot | null> {
  const url = credentials?.workerUrl?.trim();
  const token = credentials?.adminToken?.trim();
  if (!url || !token) return null;

  const base = url.replace(/\/$/, "");
  const res = await fetch(
    `${base}/console/mailbox-health?staleDays=${staleDays}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 503) return null;
  if (!res.ok) {
    throw new Error(`Mailbox health failed (${res.status})`);
  }
  return (await res.json()) as MailboxHealthSnapshot;
}

export function useMailboxHealth(staleDays = 1): MailboxHealthResult {
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;

  const [snapshot, setSnapshot] = useState<MailboxHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force?: boolean) => {
      if (!force) setLoading(true);
      else setRefreshing(true);
      try {
        const next = await fetchMailboxHealth(credentials, staleDays);
        setSnapshot(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mailbox health");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [credentials, staleDays],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh: () => void load(true),
  };
}

/** Build a "last inbound" display string + stale flag for a domain. */
export function lastInboundForDomain(
  snapshot: MailboxHealthSnapshot | null,
  domain: string,
): { label: string; stale: boolean; at: string | null } {
  const normalized = domain.trim().toLowerCase();
  const entry = snapshot?.domains.find((d) => d.domain === normalized);
  if (!entry) return { label: "—", stale: false, at: null };
  if (!entry.inbound.lastAt) {
    return { label: "Never", stale: entry.inbound.count === 0 ? false : true, at: null };
  }
  const at = new Date(entry.inbound.lastAt);
  const label = at.toLocaleString();
  return { label, stale: entry.inbound.stale, at: entry.inbound.lastAt };
}
