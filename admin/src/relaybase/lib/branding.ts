import { CloudflareClient } from "@/lib/cloudflare/client";
import type { CfDnsRecord } from "@/lib/cloudflare/client";
import type { CloudflareClientCredentials } from "@/lib/cloudflare/client";
import { resolveEmailCloudflareCredentials } from "@/relaybase-email/lib/email-cloudflare";

import {
  readEmailSenderSettings,
  type DomainBrandingConfig,
  type EmailSenderSettings,
} from "./settings";

export type { DomainBrandingConfig } from "./settings";
export type DmarcPolicy = DomainBrandingConfig["dmarcPolicy"];

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

function defaultBrandingForDomain(domain: string): DomainBrandingConfig {
  return {
    dmarcPolicy: "quarantine",
    dmarcRua: `dmarc@${domain}`,
  };
}

export function getDomainBrandingConfig(
  settings: EmailSenderSettings,
  domain: string,
): DomainBrandingConfig {
  const stored = settings.domainBranding[domain.toLowerCase()];
  return stored ?? defaultBrandingForDomain(domain);
}

function dmarcRecordName(domain: string): string {
  return `_dmarc.${domain}`;
}

/** Only used to find and remove leftover records from the retired BIMI feature. */
function legacyBimiRecordName(domain: string): string {
  return `default._bimi.${domain}`;
}

export function buildDmarcContent(config: DomainBrandingConfig): string {
  const rua = config.dmarcRua.trim().replace(/^mailto:/i, "");
  return `v=DMARC1; p=${config.dmarcPolicy}; rua=mailto:${rua}; adkim=s; aspf=s`;
}

function txtRecordMatches(
  records: CfDnsRecord[],
  name: string,
  includes: string,
): CfDnsRecord | undefined {
  const target = name.toLowerCase();
  return records.find(
    (record) =>
      record.type === "TXT" &&
      record.name.toLowerCase() === target &&
      record.content.includes(includes),
  );
}

function parseDmarcPolicy(content: string): DmarcPolicy | null {
  const match = content.match(/;\s*p\s*=\s*(none|quarantine|reject)/i);
  if (!match) return null;
  return match[1].toLowerCase() as DmarcPolicy;
}

export async function createEmailSenderDnsClient(
  settings?: EmailSenderSettings,
): Promise<CloudflareClient> {
  const creds = await resolveBrandingDnsCredentials(settings);
  if (!creds.accountId || !creds.apiToken) {
    throw new Error(
      "Cloudflare account ID and API token are required in Relaybase settings.",
    );
  }
  return CloudflareClient.create(creds);
}

async function resolveBrandingDnsCredentials(
  settings?: EmailSenderSettings,
): Promise<CloudflareClientCredentials> {
  const s = settings ?? (await readEmailSenderSettings());
  let macpurity: ReturnType<typeof resolveEmailCloudflareCredentials> | null =
    null;
  try {
    macpurity = resolveEmailCloudflareCredentials("macpurity");
  } catch {
    macpurity = null;
  }

  const accountId =
    s.cloudflareAccountId.trim() || macpurity?.accountId.trim() || "";
  const apiToken =
    s.cloudflareApiToken.trim() || macpurity?.apiToken.trim() || "";
  const senderDnsToken = s.cloudflareDnsApiToken.trim();
  const macpurityDnsToken = macpurity?.dnsApiToken.trim() ?? "";

  return {
    accountId,
    apiToken,
    dnsApiToken: senderDnsToken || macpurityDnsToken || apiToken,
    apiEmail: macpurity?.apiEmail,
    globalApiKey: macpurity?.globalApiKey,
  };
}

function dnsApplyAccess(creds: CloudflareClientCredentials): {
  canApply: boolean;
  hint: string | null;
} {
  const hasDedicatedDnsToken = Boolean(
    creds.dnsApiToken?.trim() && creds.dnsApiToken.trim() !== creds.apiToken.trim(),
  );
  const hasGlobalKey = Boolean(creds.apiEmail?.trim() && creds.globalApiKey?.trim());
  if (hasDedicatedDnsToken || hasGlobalKey) {
    return { canApply: true, hint: null };
  }
  return {
    canApply: false,
    hint:
      "The Email Sending API token can read DNS but cannot create TXT records. " +
      "Add a Cloudflare DNS API token (Zone → DNS → Edit) in Relaybase → Settings, " +
      "or set Account email + Global API Key in MacPurity → Email → Cloudflare settings.",
  };
}

async function resolveZoneId(
  cf: CloudflareClient,
  settings: EmailSenderSettings,
  domain: string,
): Promise<string | null> {
  const configured = settings.cloudflareZoneId.trim();
  if (configured) return configured;
  return cf.resolveZoneId(domain);
}

export async function fetchDomainBrandingStatus(
  domain: string,
  settings?: EmailSenderSettings,
): Promise<DomainBrandingStatus> {
  const s = settings ?? (await readEmailSenderSettings());
  const normalizedDomain = domain.trim().toLowerCase();
  const config = getDomainBrandingConfig(s, normalizedDomain);
  const dmarcExpected = buildDmarcContent(config);
  const notes: string[] = [
    "DMARC authenticates this domain's mail (SPF/DKIM alignment) — it does not control any inbox logo.",
  ];
  const creds = await resolveBrandingDnsCredentials(s);
  const dnsAccess = dnsApplyAccess(creds);

  if (!s.cloudflareAccountId.trim() || !s.cloudflareApiToken.trim()) {
    return {
      domain: normalizedDomain,
      zoneId: null,
      dnsConfigured: false,
      dnsCanApply: false,
      dnsApplyHint: dnsAccess.hint,
      settings: config,
      dmarc: {
        type: "TXT",
        name: dmarcRecordName(normalizedDomain),
        expected: dmarcExpected,
        current: null,
        found: false,
        recordId: null,
      },
      dmarcEnforced: false,
      notes,
    };
  }

  const cf = await createEmailSenderDnsClient(s);
  const zoneId = await resolveZoneId(cf, s, normalizedDomain);
  if (!zoneId) {
    return {
      domain: normalizedDomain,
      zoneId: null,
      dnsConfigured: false,
      dnsCanApply: dnsAccess.canApply,
      dnsApplyHint: dnsAccess.hint,
      settings: config,
      dmarc: {
        type: "TXT",
        name: dmarcRecordName(normalizedDomain),
        expected: dmarcExpected,
        current: null,
        found: false,
        recordId: null,
      },
      dmarcEnforced: false,
      notes: [
        ...notes,
        "Could not resolve the Cloudflare zone ID. Set it in Relaybase → Settings.",
      ],
    };
  }

  const records = await cf.listDnsRecords(zoneId, 200);
  const dmarcRecord = txtRecordMatches(
    records,
    dmarcRecordName(normalizedDomain),
    "v=DMARC1",
  );
  const dmarcPolicy =
    (dmarcRecord && parseDmarcPolicy(dmarcRecord.content)) ?? null;
  const dmarcEnforced =
    dmarcPolicy === "quarantine" || dmarcPolicy === "reject";

  return {
    domain: normalizedDomain,
    zoneId,
    dnsConfigured: true,
    dnsCanApply: dnsAccess.canApply,
    dnsApplyHint: dnsAccess.hint,
    settings: config,
    dmarc: {
      type: "TXT",
      name: dmarcRecordName(normalizedDomain),
      expected: dmarcExpected,
      current: dmarcRecord?.content ?? null,
      found: Boolean(dmarcRecord),
      recordId: dmarcRecord?.id ?? null,
    },
    dmarcEnforced,
    notes,
  };
}

/**
 * Removes any leftover `default._bimi.<domain>` TXT record from the retired
 * BIMI/inbox-logo feature. Safe to call repeatedly — a no-op once cleaned up.
 * See docs/bimi-vmc-do-not-build.md for why BIMI is not coming back.
 */
async function removeLegacyBimiRecord(
  cf: CloudflareClient,
  zoneId: string,
  domain: string,
): Promise<void> {
  const records = await cf.listDnsRecords(zoneId, 200);
  const bimiRecord = txtRecordMatches(
    records,
    legacyBimiRecordName(domain),
    "v=BIMI1",
  );
  if (bimiRecord) {
    await cf.deleteDnsRecord(zoneId, bimiRecord.id);
  }
}

export async function applyDomainBrandingDns(params: {
  domain: string;
  settings?: EmailSenderSettings;
}): Promise<DomainBrandingStatus> {
  const s = params.settings ?? (await readEmailSenderSettings());
  const normalizedDomain = params.domain.trim().toLowerCase();
  const config = getDomainBrandingConfig(s, normalizedDomain);
  const creds = await resolveBrandingDnsCredentials(s);
  const dnsAccess = dnsApplyAccess(creds);
  if (!dnsAccess.canApply) {
    throw new Error(dnsAccess.hint ?? "Cloudflare DNS write access is not configured.");
  }

  const cf = await createEmailSenderDnsClient(s);
  const zoneId = await resolveZoneId(cf, s, normalizedDomain);
  if (!zoneId) {
    throw new Error(
      `Could not resolve Cloudflare zone for ${normalizedDomain}. Set the zone ID in Relaybase → Settings.`,
    );
  }

  await cf.upsertDnsRecord(zoneId, {
    type: "TXT",
    name: dmarcRecordName(normalizedDomain),
    content: buildDmarcContent(config),
    ttl: 1,
  });

  await removeLegacyBimiRecord(cf, zoneId, normalizedDomain);

  return fetchDomainBrandingStatus(normalizedDomain, s);
}
