"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { clearEmailCache } from "@/email/components/mailbox/email-cached-fetch";
import { useEmailPaths } from "@/email/lib/paths";
import { listCloudflareZones } from "@/lib/dashboard/list-cf-zones";
import { useDomain } from "@/lib/dashboard/DomainContext";
import type { DomainSummary } from "@/lib/dashboard/domain-store";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api";
import { connectedCfAccountId } from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { studioApi } from "@/studio/api";
import { hydrateWorkerUrlFromStudioAccountLink } from "@/studio/lib/send/hydrate-worker-url-from-account-link";

function minimalDomainSummary(domain: string): DomainSummary {
  return {
    domain,
    active: true,
    addressCount: 0,
    audienceCount: 0,
    broadcastCount: 0,
    sentCount: 0,
    r2Provisioned: false,
    r2BucketName: null,
    r2WorkerReady: false,
    onboarding: null,
  };
}

async function fetchEmailJson<T>(url: string): Promise<T | null> {
  try {
    const res = await desktopAwareFetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await readResponseJson<T>(res);
  } catch {
    return null;
  }
}

async function collectClientWorkerDomainNames(apiBase: string): Promise<string[]> {
  const names = new Set<string>();

  const [catalog, addresses, keys] = await Promise.all([
    fetchEmailJson<{ domains?: Array<{ domain?: string }> }>(`${apiBase}/domains`),
    fetchEmailJson<{ addresses?: Array<{ domain?: string; email?: string }> }>(
      `${apiBase}/addresses?all=1`,
    ),
    fetchEmailJson<{ keys?: Array<{ domain?: string }> }>(`${apiBase}/keys`),
  ]);

  for (const row of catalog?.domains ?? []) {
    const d = row.domain?.trim().toLowerCase();
    if (d) names.add(d);
  }
  for (const row of addresses?.addresses ?? []) {
    const fromField = row.domain?.trim().toLowerCase();
    const fromEmail = row.email?.split("@")[1]?.trim().toLowerCase();
    const d = fromField || fromEmail;
    if (d) names.add(d);
  }
  for (const row of keys?.keys ?? []) {
    const d = row.domain?.trim().toLowerCase();
    if (d) names.add(d);
  }

  return [...names];
}

async function collectCloudflareZoneNames(
  cfAccountId: string,
): Promise<string[]> {
  if (!cfAccountId.trim()) return [];
  try {
    const zones = await listCloudflareZones(cfAccountId);
    return zones
      .map((z) => z.name.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function collectStudioServerDomainNames(): Promise<string[]> {
  try {
    const data = await studioApi.listWorkerCatalogDomains();
    return (data.domains ?? [])
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function mergeDomainSummaries(
  catalog: DomainSummary[],
  extraNames: string[],
): DomainSummary[] {
  const byName = new Map<string, DomainSummary>();
  for (const d of catalog) {
    byName.set(d.domain.trim().toLowerCase(), d);
  }
  for (const name of extraNames) {
    if (!byName.has(name)) {
      byName.set(name, minimalDomainSummary(name));
    }
  }
  return [...byName.values()].sort((a, b) => a.domain.localeCompare(b.domain));
}

/** Sending domains: Relaybase Worker catalog, CF zones, accounts/keys, and Studio server fallback. */
export function useWorkerDomains() {
  const productId = useProductId();
  const domainStore = useDomain();
  const { apiBase } = useEmailPaths();
  const desktop = useOptionalDesktop();
  const cfAccountId = connectedCfAccountId(desktop?.credentials ?? null);

  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [auxLoading, setAuxLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setAuxLoading(true);
    clearEmailCache(productId, "domains:catalog");
    await hydrateWorkerUrlFromStudioAccountLink();

    const auxPromise = (async () => {
      const [clientNames, zoneNames, serverNames] = await Promise.all([
        collectClientWorkerDomainNames(apiBase),
        collectCloudflareZoneNames(cfAccountId),
        collectStudioServerDomainNames(),
      ]);
      const merged = new Set<string>([...clientNames, ...zoneNames, ...serverNames]);
      setExtraNames([...merged]);
    })()
      .catch(() => {
        setExtraNames([]);
      })
      .finally(() => {
        setAuxLoading(false);
      });

    await domainStore.refresh();
    if (domainStore.error) {
      setError(domainStore.error);
    }

    await auxPromise;
  }, [apiBase, cfAccountId, domainStore, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const domains = useMemo(
    () => mergeDomainSummaries(domainStore.domains, extraNames),
    [domainStore.domains, extraNames],
  );

  const readyDomains = useMemo(
    () =>
      domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domains],
  );

  const readyDomainNames = useMemo(
    () =>
      [...readyDomains.map((d) => d.domain)].sort((a, b) => a.localeCompare(b)),
    [readyDomains],
  );

  const loading =
    (domainStore.loading && domains.length === 0) ||
    (auxLoading && domains.length === 0);

  return {
    domains,
    readyDomains,
    readyDomainNames,
    loading,
    error: error ?? domainStore.error,
    refresh: load,
  };
}
