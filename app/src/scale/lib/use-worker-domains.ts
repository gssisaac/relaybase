"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchEmailCachedOptional } from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import type { DomainSummary } from "@/lib/dashboard/domain-store";
import { useEmailPaths } from "@/email/lib/paths";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";

const CACHE_KEY = "domains:catalog";

/** Domains registered on the customer Worker (`GET /console/domains` via `/api/email/domains`). */
export function useWorkerDomains() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const stale = readEmailStale<{ domains?: DomainSummary[] }>(productId, CACHE_KEY);
    if (stale?.domains) setDomains(stale.domains);

    const result = await fetchEmailCachedOptional<{ domains?: DomainSummary[] }>(
      productId,
      CACHE_KEY,
      `${apiBase}/domains`,
      { onUpdate: (data) => setDomains(data?.domains ?? []) },
    );
    if (result.ok) setDomains(result.data?.domains ?? []);
    else setError("Could not load domains from Worker");
    setLoading(false);
  }, [apiBase, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const readyDomains = useMemo(
    () =>
      domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domains],
  );

  const readyDomainNames = useMemo(
    () => [...readyDomains.map((d) => d.domain)].sort((a, b) => a.localeCompare(b)),
    [readyDomains],
  );

  return { domains, readyDomains, readyDomainNames, loading, error, refresh: load };
}
