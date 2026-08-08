"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { useDomain } from "@/lib/dashboard/DomainContext";

function normalizeDomainParam(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^@+/, "");
}

/** Build `?domain=…` (+ extras) for dashboard API fetches. */
export function domainQuery(
  domain: string | null | undefined,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  const normalized = normalizeDomainParam(domain);
  if (normalized) params.set("domain", normalized);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Dashboard-only domain scope from the URL `?domain=` param.
 * Missing/invalid values are replaced with the first ready domain (client-only).
 */
export function useDashboardDomain() {
  const { domains, loading } = useDomain();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const readyDomains = useMemo(
    () =>
      domains.filter(
        (entry) =>
          !entry.onboarding || entry.onboarding.status === "ready",
      ),
    [domains],
  );

  const candidates = readyDomains.length > 0 ? readyDomains : domains;

  const requested = normalizeDomainParam(searchParams.get("domain"));
  const validRequested =
    requested && candidates.some((d) => d.domain === requested)
      ? requested
      : null;
  const fallback = candidates[0]?.domain ?? null;
  const domain = validRequested ?? fallback;

  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    if (loading || !fallback) return;
    if (validRequested) return;

    const params = new URLSearchParams(searchParamsKey);
    params.set("domain", fallback);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    fallback,
    loading,
    pathname,
    router,
    searchParamsKey,
    validRequested,
  ]);

  const setDomain = useCallback(
    (next: string) => {
      const normalized = normalizeDomainParam(next);
      if (!normalized || normalized === domain) return;
      const params = new URLSearchParams(searchParamsKey);
      params.set("domain", normalized);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [domain, pathname, router, searchParamsKey],
  );

  const hrefWithDomain = useCallback(
    (href: string, domainOverride?: string | null) => {
      const d = normalizeDomainParam(domainOverride ?? domain);
      if (!d) return href;
      const [path, existingQs] = href.split("?");
      const params = new URLSearchParams(existingQs ?? "");
      params.set("domain", d);
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path!;
    },
    [domain],
  );

  const buildDomainQuery = useCallback(
    (extra?: Record<string, string>) => domainQuery(domain, extra),
    [domain],
  );

  return {
    domain,
    loading,
    domains,
    readyDomains,
    setDomain,
    domainQuery: buildDomainQuery,
    hrefWithDomain,
  };
}
