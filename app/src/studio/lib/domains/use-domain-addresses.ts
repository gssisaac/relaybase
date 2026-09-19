"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchEmailCachedOptional } from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import type { Address } from "@/email/components/mailbox/types";
import { useEmailPaths } from "@/email/lib/paths";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";

export function useDomainAddresses(domain: string | null | undefined) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stale = readEmailStale<{ addresses?: Address[] }>(productId, "addresses:all");
    if (stale) setAddresses(stale.addresses ?? []);

    setLoading(true);
    void fetchEmailCachedOptional<{ addresses?: Address[] }>(
      productId,
      "addresses:all",
      `${apiBase}/addresses?all=1`,
      { onUpdate: (data) => setAddresses(data?.addresses ?? []) },
    )
      .then((r) => {
        if (r.ok) setAddresses(r.data?.addresses ?? []);
      })
      .finally(() => setLoading(false));
  }, [apiBase, productId]);

  const normalizedDomain = domain?.trim().toLowerCase() ?? "";

  const domainAddresses = useMemo(() => {
    if (!normalizedDomain) return [];
    return addresses.filter((a) => a.domain?.toLowerCase() === normalizedDomain);
  }, [addresses, normalizedDomain]);

  const displayNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const a of domainAddresses) {
      const label = a.displayName?.trim() || a.email.split("@")[0] || a.email;
      if (seen.has(label)) continue;
      seen.add(label);
      options.push(label);
    }
    return options;
  }, [domainAddresses]);

  return { addresses, domainAddresses, displayNameOptions, loading };
}

export function displayNameForAddress(address: Address): string {
  return address.displayName?.trim() || address.email.split("@")[0] || address.email;
}
