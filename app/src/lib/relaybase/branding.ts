import fs from "fs";
import path from "path";

import {
  getDomainBranding,
  normalizeDomain,
  type DomainBrandingConfig,
  type DevUserEmailData,
} from "@/lib/dev-email-store";
import { readRelaybaseEnvSettings } from "@/lib/relaybase/env-settings";
import { readRelaybasePlatformConfig } from "@/lib/relaybase/provision-domain-r2";

const API_BASE = "https://api.cloudflare.com/client/v4";

export type BrandingDnsRecordStatus = {
  type: "TXT";
  name: string;
  expected: string;
  current: string | null;
  found: boolean;
  recordId: string | null;
};

/**
 * Plain-language status shown to end users. Internal-only concepts (DMARC,
 * BIMI, VMC/CMC, DNS TXT records) never surface through this type or its
 * accompanying message — see `deriveUserStatus`.
 */
export type BrandingUserStatus =
  | "not_set"
  | "setting_up"
  | "needs_verification"
  | "ready";

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
  logoStoredLocally: boolean;
  hasVerificationFile: boolean;
  userStatus: BrandingUserStatus;
  userMessage: string;
  notes: string[];
};

type CfDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
};

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
  const logo = config.bimiLogoUrl.trim();
  const vmc = config.vmcUrl?.trim();
  return vmc
    ? `v=BIMI1; l=${logo}; a=${vmc};`
    : `v=BIMI1; l=${logo};`;
}

function brandingLogoPath(domain: string): string {
  const safe = normalizeDomain(domain).replace(/[^a-z0-9.-]/g, "_");
  return path.join(process.cwd(), "..", "data", "branding", safe, "logo.svg");
}

export function hasLocalBrandingLogo(domain: string): boolean {
  return fs.existsSync(brandingLogoPath(domain));
}

export function readLocalBrandingLogo(domain: string): Buffer | null {
  const file = brandingLogoPath(domain);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

export function writeLocalBrandingLogo(domain: string, svg: Buffer): string {
  const file = brandingLogoPath(domain);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg);
  return file;
}

function brandingVerificationPath(domain: string): string {
  const safe = normalizeDomain(domain).replace(/[^a-z0-9.-]/g, "_");
  return path.join(process.cwd(), "..", "data", "branding", safe, "verification.pem");
}

export function hasLocalVerificationFile(domain: string): boolean {
  return fs.existsSync(brandingVerificationPath(domain));
}

export function readLocalVerificationFile(domain: string): Buffer | null {
  const file = brandingVerificationPath(domain);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

export function writeLocalVerificationFile(domain: string, contents: Buffer): string {
  const file = brandingVerificationPath(domain);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}

export type LogoUploadMimeType = "image/svg+xml" | "image/png" | "image/jpeg";

/** Sniffs the first bytes of an upload to detect a supported logo format. */
export function detectLogoMimeType(bytes: Buffer): LogoUploadMimeType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const head = bytes.subarray(0, 2000).toString("utf8");
  if (head.includes("<svg")) return "image/svg+xml";
  return null;
}

/**
 * Produces the SVG we publish for the logo, regardless of what the user
 * uploaded. True SVG passes through as-is; raster formats (PNG/JPG) are
 * wrapped in a minimal square SVG so the upload flow never asks the user
 * about file formats. Note: wrapping a raster image does not meet the
 * strict SVG Tiny PS profile some mailbox providers require for their
 * circular logo — that constraint is inherent to the raster source, not
 * something format conversion alone can fix.
 */
export function buildLogoSvgFromUpload(
  bytes: Buffer,
  mimeType: LogoUploadMimeType,
): Buffer {
  if (mimeType === "image/svg+xml") return bytes;
  const base64 = bytes.toString("base64");
  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512" role="img">',
    '  <rect width="512" height="512" fill="#ffffff"/>',
    `  <image x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid meet" xlink:href="data:${mimeType};base64,${base64}" />`,
    "</svg>",
    "",
  ].join("\n");
  return Buffer.from(svg, "utf8");
}

/**
 * Resolves the public origin to host logo/verification assets at, from an
 * incoming request. Behind a reverse proxy (Cloudflare/Vercel) the request's
 * own scheme can report the internal `http` hop, so we prefer
 * `x-forwarded-proto` and otherwise default to `https` for any non-local
 * host — mailbox providers will only fetch BIMI assets over HTTPS anyway.
 */
export function publicAssetOrigin(request: Request): string {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.trim() ||
    request.headers.get("host")?.trim() ||
    url.host;
  const isLocal = /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/i.test(host);
  const proto =
    request.headers.get("x-forwarded-proto")?.trim().split(",")[0]?.trim() ||
    (isLocal ? url.protocol.replace(":", "") : "https");
  return `${proto}://${host}`;
}

function resolveDnsCredentials() {
  const env = readRelaybaseEnvSettings();
  const platform = readRelaybasePlatformConfig();
  const accountId =
    env.cloudflareAccountId || platform.cloudflareAccountId || "";
  const apiToken = env.cloudflareApiToken || platform.cloudflareApiToken || "";
  const dnsToken = env.cloudflareDnsApiToken || apiToken;
  const zoneId = env.cloudflareZoneId || "";
  return { accountId, apiToken, dnsToken, zoneId };
}

function dnsApplyAccess(creds: {
  apiToken: string;
  dnsToken: string;
}): { canApply: boolean; hint: string | null } {
  if (!creds.apiToken && !creds.dnsToken) {
    return {
      canApply: false,
      hint: "Cloudflare API credentials are required to apply DMARC/BIMI DNS.",
    };
  }
  if (creds.dnsToken && creds.dnsToken !== creds.apiToken) {
    return { canApply: true, hint: null };
  }
  return {
    canApply: true,
    hint:
      "Using the general Cloudflare API token for DNS writes. Prefer a dedicated DNS Edit token if apply fails.",
  };
}

async function cfRequest<T>(
  token: string,
  pathname: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await res.json()) as {
    success: boolean;
    errors?: Array<{ message: string }>;
    result: T;
  };
  if (!res.ok || !data.success) {
    const message =
      data.errors?.map((e) => e.message).join("; ") ||
      `Cloudflare API failed (${res.status})`;
    throw new Error(message);
  }
  return data.result;
}

async function resolveZoneId(
  token: string,
  domain: string,
  configuredZoneId: string,
): Promise<string | null> {
  if (configuredZoneId) return configuredZoneId;
  const zones = await cfRequest<Array<{ id: string; name: string }>>(
    token,
    `/zones?name=${encodeURIComponent(domain)}`,
  );
  return zones.find((z) => z.name.toLowerCase() === domain)?.id ?? zones[0]?.id ?? null;
}

async function listTxtRecords(
  token: string,
  zoneId: string,
): Promise<CfDnsRecord[]> {
  const records = await cfRequest<CfDnsRecord[]>(
    token,
    `/zones/${zoneId}/dns_records?type=TXT&per_page=200`,
  );
  return records ?? [];
}

function findTxt(
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

function parseDmarcPolicy(
  content: string,
): DomainBrandingConfig["dmarcPolicy"] | null {
  const match = content.match(/;\s*p\s*=\s*(none|quarantine|reject)/i);
  if (!match) return null;
  return match[1]!.toLowerCase() as DomainBrandingConfig["dmarcPolicy"];
}

async function upsertTxt(
  token: string,
  zoneId: string,
  name: string,
  content: string,
): Promise<void> {
  const records = await listTxtRecords(token, zoneId);
  const existing = records.find(
    (record) =>
      record.type === "TXT" && record.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    await cfRequest(token, `/zones/${zoneId}/dns_records/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ type: "TXT", name, content, ttl: 1 }),
    });
    return;
  }
  await cfRequest(token, `/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ type: "TXT", name, content, ttl: 1 }),
  });
}

export function upsertDomainBranding(
  data: DevUserEmailData,
  domain: string,
  patch: Partial<DomainBrandingConfig>,
): DomainBrandingConfig {
  const normalized = normalizeDomain(domain);
  const current = getDomainBranding(data, normalized);
  const next: DomainBrandingConfig = {
    dmarcPolicy: patch.dmarcPolicy ?? current.dmarcPolicy,
    dmarcRua: patch.dmarcRua?.trim() || current.dmarcRua,
    bimiLogoUrl: patch.bimiLogoUrl?.trim() || current.bimiLogoUrl,
    ...(patch.vmcUrl !== undefined
      ? { vmcUrl: patch.vmcUrl.trim() || undefined }
      : current.vmcUrl
        ? { vmcUrl: current.vmcUrl }
        : {}),
  };
  data.domainBranding = {
    ...(data.domainBranding ?? {}),
    [normalized]: next,
  };
  return next;
}

function deriveUserStatus(params: {
  hasLogo: boolean;
  dnsReady: boolean;
  hasVerificationFile: boolean;
}): { userStatus: BrandingUserStatus; userMessage: string } {
  if (!params.hasLogo) {
    return {
      userStatus: "not_set",
      userMessage: "Upload a logo to show your brand next to your emails.",
    };
  }
  if (!params.dnsReady) {
    return {
      userStatus: "setting_up",
      userMessage: "Setting up your logo. This can take a few minutes.",
    };
  }
  if (!params.hasVerificationFile) {
    return {
      userStatus: "needs_verification",
      userMessage:
        "Gmail needs a one-time check before it will show your logo next to your emails.",
    };
  }
  return {
    userStatus: "ready",
    userMessage: "Your logo is ready and will show up in supported inboxes.",
  };
}

export async function fetchDomainBrandingStatus(
  data: DevUserEmailData,
  domain: string,
): Promise<DomainBrandingStatus> {
  const normalized = normalizeDomain(domain);
  const config = getDomainBranding(data, normalized);
  const dmarcExpected = buildDmarcContent(config);
  const bimiExpected = buildBimiContent(config);
  const notes: string[] = [
    "Set one logo per domain under Branding. All accounts on this domain share it.",
    "Gmail usually needs a Verified Mark Certificate (VMC) before showing the circular BIMI logo.",
    "Without VMC, Gmail keeps the letter avatar even when BIMI DNS and the SVG are correct.",
  ];
  const creds = resolveDnsCredentials();
  const access = dnsApplyAccess(creds);
  const logoStoredLocally = hasLocalBrandingLogo(normalized);
  const hasVerificationFile =
    hasLocalVerificationFile(normalized) || Boolean(config.vmcUrl?.trim());

  const emptyStatus = (
    zoneId: string | null,
    dnsConfigured: boolean,
  ): DomainBrandingStatus => ({
    domain: normalized,
    zoneId,
    dnsConfigured,
    dnsCanApply: access.canApply && Boolean(creds.dnsToken || creds.apiToken),
    dnsApplyHint: access.hint,
    settings: config,
    dmarc: {
      type: "TXT",
      name: dmarcRecordName(normalized),
      expected: dmarcExpected,
      current: null,
      found: false,
      recordId: null,
    },
    bimi: {
      type: "TXT",
      name: bimiRecordName(normalized),
      expected: bimiExpected,
      current: null,
      found: false,
      recordId: null,
    },
    dmarcEnforced: false,
    bimiReady: false,
    logoStoredLocally,
    hasVerificationFile,
    ...deriveUserStatus({
      hasLogo: logoStoredLocally,
      dnsReady: false,
      hasVerificationFile,
    }),
    notes,
  });

  if (!creds.accountId || !creds.apiToken) {
    return emptyStatus(null, false);
  }

  try {
    const token = creds.dnsToken || creds.apiToken;
    const zoneId = await resolveZoneId(token, normalized, creds.zoneId);
    if (!zoneId) {
      return {
        ...emptyStatus(null, false),
        notes: [
          ...notes,
          "Could not resolve the Cloudflare zone ID for this domain.",
        ],
      };
    }

    const records = await listTxtRecords(token, zoneId);
    const dmarcRecord = findTxt(records, dmarcRecordName(normalized), "v=DMARC1");
    const bimiRecord = findTxt(records, bimiRecordName(normalized), "v=BIMI1");
    const dmarcPolicy =
      (dmarcRecord && parseDmarcPolicy(dmarcRecord.content)) ?? null;
    const dmarcEnforced =
      dmarcPolicy === "quarantine" || dmarcPolicy === "reject";
    const dnsReady = dmarcEnforced && Boolean(bimiRecord);

    return {
      domain: normalized,
      zoneId,
      dnsConfigured: true,
      dnsCanApply: access.canApply,
      dnsApplyHint: access.hint,
      settings: config,
      dmarc: {
        type: "TXT",
        name: dmarcRecordName(normalized),
        expected: dmarcExpected,
        current: dmarcRecord?.content ?? null,
        found: Boolean(dmarcRecord),
        recordId: dmarcRecord?.id ?? null,
      },
      bimi: {
        type: "TXT",
        name: bimiRecordName(normalized),
        expected: bimiExpected,
        current: bimiRecord?.content ?? null,
        found: Boolean(bimiRecord),
        recordId: bimiRecord?.id ?? null,
      },
      dmarcEnforced,
      bimiReady: dnsReady,
      logoStoredLocally,
      hasVerificationFile,
      ...deriveUserStatus({ hasLogo: logoStoredLocally, dnsReady, hasVerificationFile }),
      notes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "DNS lookup failed";
    return {
      ...emptyStatus(creds.zoneId || null, false),
      notes: [...notes, message],
    };
  }
}

/**
 * Applies DMARC + BIMI DNS automatically after a logo/verification upload.
 * Failures (e.g. missing DNS credentials) are swallowed — the resulting
 * status simply stays "setting_up" and the existing domain-connection
 * alerts elsewhere in Settings guide the user to fix access.
 */
export async function autoSyncDomainBranding(
  data: DevUserEmailData,
  domain: string,
): Promise<DomainBrandingStatus> {
  try {
    return await applyDomainBrandingDns(data, {
      domain,
      applyDmarc: true,
      applyBimi: true,
    });
  } catch {
    return fetchDomainBrandingStatus(data, domain);
  }
}

export async function applyDomainBrandingDns(
  data: DevUserEmailData,
  params: {
    domain: string;
    applyDmarc?: boolean;
    applyBimi?: boolean;
  },
): Promise<DomainBrandingStatus> {
  const normalized = normalizeDomain(params.domain);
  const config = getDomainBranding(data, normalized);
  const creds = resolveDnsCredentials();
  const access = dnsApplyAccess(creds);
  if (!access.canApply || !(creds.dnsToken || creds.apiToken)) {
    throw new Error(access.hint ?? "Cloudflare DNS write access is not configured.");
  }

  const token = creds.dnsToken || creds.apiToken;
  const zoneId = await resolveZoneId(token, normalized, creds.zoneId);
  if (!zoneId) {
    throw new Error(`Could not resolve Cloudflare zone for ${normalized}.`);
  }

  if (params.applyDmarc !== false) {
    await upsertTxt(
      token,
      zoneId,
      dmarcRecordName(normalized),
      buildDmarcContent(config),
    );
  }
  if (params.applyBimi !== false) {
    await upsertTxt(
      token,
      zoneId,
      bimiRecordName(normalized),
      buildBimiContent(config),
    );
  }

  return fetchDomainBrandingStatus(data, normalized);
}

export { getDomainBranding };
