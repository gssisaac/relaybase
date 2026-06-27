"use client";

import * as React from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";

export type DomainSummary = {
  domain: string;
  active: boolean;
  addressCount: number;
  audienceCount: number;
  broadcastCount: number;
  sentCount: number;
  r2Provisioned: boolean;
  r2BucketName: string | null;
  r2WorkerReady: boolean;
};

type DomainContextValue = {
  domains: DomainSummary[];
  activeDomain: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setActiveDomain: (domain: string) => Promise<void>;
  addDomain: (domain: string) => Promise<{ message: string; r2Error?: string | null }>;
  removeDomain: (domain: string) => Promise<void>;
  domainQuery: (extra?: Record<string, string>) => string;
};

const DomainContext = React.createContext<DomainContextValue | null>(null);

export function DomainProvider({ children }: { children: React.ReactNode }) {
  const userId = useProductId();
  const [domains, setDomains] = React.useState<DomainSummary[]>([]);
  const [activeDomain, setActiveDomainState] = React.useState<string | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/email/domains", { cache: "no-store" });
      const data = (await res.json()) as {
        domains?: DomainSummary[];
        activeDomain?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load domains");
      setDomains(data.domains ?? []);
      setActiveDomainState(data.activeDomain ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load domains");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh, userId]);

  const setActiveDomain = React.useCallback(
    async (domain: string) => {
      setError(null);
      const res = await fetch("/api/email/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeDomain: domain }),
      });
      const data = (await res.json()) as {
        domains?: DomainSummary[];
        activeDomain?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to update domain");
      setDomains(data.domains ?? []);
      setActiveDomainState(data.activeDomain ?? domain);
    },
    [],
  );

  const addDomain = React.useCallback(async (domain: string) => {
    setError(null);
    const res = await fetch("/api/email/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const data = (await res.json()) as {
      domains?: DomainSummary[];
      activeDomain?: string | null;
      message?: string;
      r2Error?: string | null;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to add domain");
    setDomains(data.domains ?? []);
    setActiveDomainState(data.activeDomain ?? null);
    return {
      message: data.message ?? "Domain added",
      r2Error: data.r2Error ?? null,
    };
  }, []);

  const removeDomain = React.useCallback(async (domain: string) => {
    setError(null);
    const res = await fetch(
      `/api/email/domains?domain=${encodeURIComponent(domain)}`,
      { method: "DELETE" },
    );
    const data = (await res.json()) as {
      domains?: DomainSummary[];
      activeDomain?: string | null;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to remove domain");
    setDomains(data.domains ?? []);
    setActiveDomainState(data.activeDomain ?? null);
  }, []);

  const domainQuery = React.useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams();
      if (activeDomain) params.set("domain", activeDomain);
      if (extra) {
        for (const [key, value] of Object.entries(extra)) {
          if (value) params.set(key, value);
        }
      }
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [activeDomain],
  );

  const value = React.useMemo(
    () => ({
      domains,
      activeDomain,
      loading,
      error,
      refresh,
      setActiveDomain,
      addDomain,
      removeDomain,
      domainQuery,
    }),
    [
      domains,
      activeDomain,
      loading,
      error,
      refresh,
      setActiveDomain,
      addDomain,
      removeDomain,
      domainQuery,
    ],
  );

  return (
    <DomainContext.Provider value={value}>{children}</DomainContext.Provider>
  );
}

export function useDomain(): DomainContextValue {
  const ctx = React.useContext(DomainContext);
  if (!ctx) throw new Error("DomainProvider required");
  return ctx;
}
