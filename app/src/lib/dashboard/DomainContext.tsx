"use client";

import * as React from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";

export type OnboardingStepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed";

export type OnboardingOverallStatus =
  | "idle"
  | "running"
  | "waiting"
  | "ready"
  | "failed";

export type DomainOnboardingStep = {
  id: string;
  label: string;
  status: OnboardingStepStatus;
  error?: string | null;
  updatedAt?: string;
};

export type DomainOnboardingSummary = {
  status: OnboardingOverallStatus;
  currentStep: string | null;
  currentStepLabel: string | null;
  lastError: string | null;
  zoneId: string | null;
  sendingSubdomainId: string | null;
  steps: DomainOnboardingStep[];
};

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
  onboarding: DomainOnboardingSummary | null;
};

type DomainContextValue = {
  domains: DomainSummary[];
  activeDomain: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setActiveDomain: (domain: string) => Promise<void>;
  addDomain: (domain: string) => Promise<{ message: string }>;
  removeDomain: (domain: string) => Promise<void>;
  startOnboarding: (domain: string) => Promise<{ message: string }>;
  advanceOnboarding: (domain: string) => Promise<{ message: string }>;
  retryOnboarding: (domain: string) => Promise<{ message: string }>;
  domainQuery: (extra?: Record<string, string>) => string;
};

const DomainContext = React.createContext<DomainContextValue | null>(null);

async function postOnboard(
  domain: string,
  action: "start" | "advance" | "retry",
): Promise<{
  domains: DomainSummary[];
  activeDomain: string | null;
  message: string;
}> {
  const res = await fetch("/api/email/domains/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, action }),
  });
  const data = (await res.json()) as {
    domains?: DomainSummary[];
    activeDomain?: string | null;
    message?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Onboarding request failed");
  return {
    domains: data.domains ?? [],
    activeDomain: data.activeDomain ?? null,
    message: data.message ?? "Onboarding updated",
  };
}

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
      error?: string;
      code?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to add domain");
    setDomains(data.domains ?? []);
    setActiveDomainState(data.activeDomain ?? null);
    return {
      message: data.message ?? "Domain added",
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

  const startOnboarding = React.useCallback(async (domain: string) => {
    setError(null);
    const result = await postOnboard(domain, "start");
    setDomains(result.domains);
    setActiveDomainState(result.activeDomain);
    return { message: result.message };
  }, []);

  const advanceOnboarding = React.useCallback(async (domain: string) => {
    setError(null);
    const result = await postOnboard(domain, "advance");
    setDomains(result.domains);
    setActiveDomainState(result.activeDomain);
    return { message: result.message };
  }, []);

  const retryOnboarding = React.useCallback(async (domain: string) => {
    setError(null);
    const result = await postOnboard(domain, "retry");
    setDomains(result.domains);
    setActiveDomainState(result.activeDomain);
    return { message: result.message };
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
      startOnboarding,
      advanceOnboarding,
      retryOnboarding,
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
      startOnboarding,
      advanceOnboarding,
      retryOnboarding,
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
