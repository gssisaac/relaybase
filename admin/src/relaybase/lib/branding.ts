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

export type DomainBrandingStatus = {
  domain: string;
  zoneId: string | null;
  dnsConfigured: boolean;
  dnsCanApply: boolean;
  dnsApplyHint: string | null;
  settings: DomainBrandingConfig;
  dmarc: BrandingDnsRecordStatus;
  bimi: BrandingDnsRecordStatus;
  dmarcEnforced: boolean;
  bimiReady: boolean;
  notes: string[];
};

function defaultBrandingForDomain(domain: string): DomainBrandingConfig {
  const logoUrl = `https://${domain}/bimi/logo.svg`;
  return {
    dmarcPolicy: "quarantine",
    dmarcRua: `dmarc@${domain}`,
    bimiLogoUrl: logoUrl,
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

function bimiRecordName(domain: string): string {
  return `default._bimi.${domain}`;
}

export function buildDmarcContent(config: DomainBrandingConfig): string {
  const rua = config.dmarcRua.trim().replace(/^mailto:/i, "");
  return `v=DMARC1; p=${config.dmarcPolicy}; rua=mailto:${rua}; adkim=s; aspf=s`;
}

export function buildBimiContent(config: DomainBrandingConfig): string {
  return `v=BIMI1; l=${config.bimiLogoUrl.trim()};`;
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

export function createEmailSenderDnsClient(
  settings?: EmailSenderSettings,
): CloudflareClient {
  const creds = resolveBrandingDnsCredentials(settings);
  if (!creds.accountId || !creds.apiToken) {
    throw new Error(
      "Cloudflare account ID and API token are required in Relaybase settings.",
    );
  }
  return CloudflareClient.create(creds);
}

function resolveBrandingDnsCredentials(
  settings?: EmailSenderSettings,
): CloudflareClientCredentials {
  const s = settings ?? readEmailSenderSettings();
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
  const s = settings ?? readEmailSenderSettings();
  const normalizedDomain = domain.trim().toLowerCase();
  const config = getDomainBrandingConfig(s, normalizedDomain);
  const dmarcExpected = buildDmarcContent(config);
  const bimiExpected = buildBimiContent(config);
  const notes: string[] = [
    "Gmail often requires a Verified Mark Certificate (VMC) before showing a BIMI logo.",
    "Apple Mail and some other clients may show the logo once DMARC is enforced and the SVG is reachable.",
  ];
  const creds = resolveBrandingDnsCredentials(s);
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
      bimi: {
        type: "TXT",
        name: bimiRecordName(normalizedDomain),
        expected: bimiExpected,
        current: null,
        found: false,
        recordId: null,
      },
      dmarcEnforced: false,
      bimiReady: false,
      notes,
    };
  }

  const cf = createEmailSenderDnsClient(s);
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
      bimi: {
        type: "TXT",
        name: bimiRecordName(normalizedDomain),
        expected: bimiExpected,
        current: null,
        found: false,
        recordId: null,
      },
      dmarcEnforced: false,
      bimiReady: false,
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
  const bimiRecord = txtRecordMatches(
    records,
    bimiRecordName(normalizedDomain),
    "v=BIMI1",
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
    bimi: {
      type: "TXT",
      name: bimiRecordName(normalizedDomain),
      expected: bimiExpected,
      current: bimiRecord?.content ?? null,
      found: Boolean(bimiRecord),
      recordId: bimiRecord?.id ?? null,
    },
    dmarcEnforced,
    bimiReady: dmarcEnforced && Boolean(bimiRecord),
    notes,
  };
}

export async function applyDomainBrandingDns(params: {
  domain: string;
  settings?: EmailSenderSettings;
  applyDmarc?: boolean;
  applyBimi?: boolean;
}): Promise<DomainBrandingStatus> {
  const s = params.settings ?? readEmailSenderSettings();
  const normalizedDomain = params.domain.trim().toLowerCase();
  const config = getDomainBrandingConfig(s, normalizedDomain);
  const creds = resolveBrandingDnsCredentials(s);
  const dnsAccess = dnsApplyAccess(creds);
  if (!dnsAccess.canApply) {
    throw new Error(dnsAccess.hint ?? "Cloudflare DNS write access is not configured.");
  }

  const cf = createEmailSenderDnsClient(s);
  const zoneId = await resolveZoneId(cf, s, normalizedDomain);
  if (!zoneId) {
    throw new Error(
      `Could not resolve Cloudflare zone for ${normalizedDomain}. Set the zone ID in Relaybase → Settings.`,
    );
  }

  if (params.applyDmarc !== false) {
    await cf.upsertDnsRecord(zoneId, {
      type: "TXT",
      name: dmarcRecordName(normalizedDomain),
      content: buildDmarcContent(config),
      ttl: 1,
    });
  }

  if (params.applyBimi !== false) {
    await cf.upsertDnsRecord(zoneId, {
      type: "TXT",
      name: bimiRecordName(normalizedDomain),
      content: buildBimiContent(config),
      ttl: 1,
    });
  }

  return fetchDomainBrandingStatus(normalizedDomain, s);
}
