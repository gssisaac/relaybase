export type DmarcPolicy = "none" | "quarantine" | "reject";

export type DomainBrandingConfig = {
  dmarcPolicy: DmarcPolicy;
  dmarcRua: string;
};

export type BrandingDnsRecordStatus = {
  type: "TXT";
  name: string;
  expected: string;
  current: string | null;
  found: boolean;
  recordId: string | null;
};

/**
 * Sender authentication status for a domain. BIMI/VMC (inbox logo) is not
 * part of this product — see docs/bimi-vmc-do-not-build.md before adding it
 * back.
 */
export type DomainBrandingStatus = {
  domain: string;
  zoneId: string | null;
  dnsConfigured: boolean;
  dnsCanApply: boolean;
  dnsApplyHint: string | null;
  settings: DomainBrandingConfig;
  dmarc: BrandingDnsRecordStatus;
  dmarcEnforced: boolean;
  notes: string[];
};

async function brandingFetch<T>(
  _path: string,
  _init?: RequestInit,
): Promise<T> {
  throw new Error(
    "HQ admin no longer authenticates to the product Worker. Use the desktop app.",
  );
}

export async function fetchDomainBrandingStatus(
  domain: string,
): Promise<DomainBrandingStatus> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) throw new Error("domain is required");
  return brandingFetch<DomainBrandingStatus>(
    `?domain=${encodeURIComponent(normalized)}`,
  );
}

export async function mergeDomainBrandingConfig(
  domain: string,
  patch: Partial<DomainBrandingConfig>,
): Promise<DomainBrandingStatus> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) throw new Error("domain is required");
  return brandingFetch<DomainBrandingStatus>("", {
    method: "PUT",
    body: JSON.stringify({ domain: normalized, ...patch }),
  });
}

export async function applyDomainBrandingDns(
  domain: string,
): Promise<DomainBrandingStatus> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) throw new Error("domain is required");
  return brandingFetch<DomainBrandingStatus>("", {
    method: "POST",
    body: JSON.stringify({ domain: normalized }),
  });
}
