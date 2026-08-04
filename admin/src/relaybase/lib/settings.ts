import { randomBytes } from "node:crypto";

import {
  readProductJson,
  writeProductJson,
} from "@/lib/config/product-store";
import { defaultInboundR2BucketName, resolveInboundR2BucketName } from "@/relaybase-email/lib/r2-inbound";
import { readEmailSettings } from "@/relaybase-email/lib/email-settings";
import {
  readRelaybaseEnvSettings,
  resolveSettingValue,
  type RelaybaseEnvSources,
} from "@/relaybase/lib/env-settings";

export const RELAYBASE_STORE_ID = "relaybase";

/** @deprecated Use RELAYBASE_STORE_ID */
export const EMAIL_SENDER_STORE_ID = RELAYBASE_STORE_ID;

const LEGACY_STORE_IDS = ["email-sender", "flare-email-sender"] as const;
const SETTINGS_FILE = "settings.json";

export type EmailSenderApiKeyRecord = {
  id: string;
  domain: string;
  label: string | null;
  keyPrefix: string;
  key: string;
  createdAt: string;
};

export type EmailSenderSentRecord = {
  id: string;
  keyId: string;
  keyLabel: string | null;
  domain: string;
  from: string;
  to: string;
  subject: string;
  bodyPreview: string;
  messageId: string;
  sentAt: string;
};

/** Per-user auth token issued from Relaybase Status — not a Cloudflare API token (cfut_…). */
export type RelaybaseDashboardAuthTokenRecord = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  token: string;
  createdAt: string;
};

/** @deprecated Use RelaybaseDashboardAuthTokenRecord */
export type RelaybaseDashboardAdminTokenRecord = RelaybaseDashboardAuthTokenRecord;

type StoredEmailSenderSettings = EmailSenderSettings & {
  dashboardAdminTokens?: RelaybaseDashboardAuthTokenRecord[];
};

export type EmailSenderSettings = {
  workerUrl: string;
  /** Internal worker bridge token — auto-provisioned on save, not user-facing. */
  adminToken: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  /** Cloudflare zone ID for DNS branding records (optional; auto-resolved from domain). */
  cloudflareZoneId: string;
  /** Optional token with Zone → DNS → Edit when the main token cannot manage DNS. */
  cloudflareDnsApiToken: string;
  /** R2 bucket bound on the Relaybase worker for inbound mail. */
  inboundR2BucketName: string;
  domainBranding: Record<string, DomainBrandingConfig>;
  apiKeyVault: EmailSenderApiKeyRecord[];
  sentEmails: EmailSenderSentRecord[];
  dashboardAuthTokens: RelaybaseDashboardAuthTokenRecord[];
};

/**
 * Sender authentication (DMARC) config per domain. BIMI/VMC logo display
 * was removed — see docs/bimi-vmc-do-not-build.md for why it doesn't belong
 * in this product and must not be reintroduced.
 */
export type DomainBrandingConfig = {
  dmarcPolicy: "none" | "quarantine" | "reject";
  dmarcRua: string;
};

export type EmailSenderSettingsView = {
  workerUrl: string;
  cloudflareConfigured: boolean;
  /** Worker URL + Cloudflare credentials are set (env or stored). */
  configured: boolean;
  /** Internal worker bridge token provisioned and worker accepts it. */
  workerLinked: boolean;
};

function emptySettings(): EmailSenderSettings {
  return {
    workerUrl: "",
    adminToken: "",
    cloudflareAccountId: "",
    cloudflareApiToken: "",
    cloudflareZoneId: "",
    cloudflareDnsApiToken: "",
    inboundR2BucketName: defaultInboundR2BucketName(RELAYBASE_STORE_ID),
    domainBranding: {},
    apiKeyVault: [],
    sentEmails: [],
    dashboardAuthTokens: [],
  };
}

function normalizeStoredSettings(raw: StoredEmailSenderSettings): EmailSenderSettings {
  return {
    workerUrl: raw.workerUrl?.trim().replace(/\/$/, "") ?? "",
    adminToken: raw.adminToken?.trim() ?? "",
    cloudflareAccountId: raw.cloudflareAccountId?.trim() ?? "",
    cloudflareApiToken: raw.cloudflareApiToken?.trim() ?? "",
    cloudflareZoneId: raw.cloudflareZoneId?.trim() ?? "",
    cloudflareDnsApiToken: raw.cloudflareDnsApiToken?.trim() ?? "",
    inboundR2BucketName: resolveInboundR2BucketName(
      RELAYBASE_STORE_ID,
      raw.inboundR2BucketName,
    ),
    domainBranding: raw.domainBranding ?? {},
    apiKeyVault: raw.apiKeyVault ?? [],
    sentEmails: raw.sentEmails ?? [],
    dashboardAuthTokens:
      raw.dashboardAuthTokens ?? raw.dashboardAdminTokens ?? [],
  };
}

export function looksLikeCloudflareApiToken(value: string): boolean {
  return value.trim().startsWith("cfut_");
}

export function generateRelaybaseAuthToken(): string {
  return `rb-auth-${randomBytes(24).toString("hex")}`;
}

/** Internal worker bridge token — not issued to users. */
export function generateWorkerServiceToken(): string {
  return `rb-svc-${randomBytes(24).toString("hex")}`;
}

/** @deprecated Use generateRelaybaseAuthToken */
export function generateRelaybaseAdminToken(): string {
  return generateRelaybaseAuthToken();
}

function relaybaseAuthTokenPrefix(token: string): string {
  const trimmed = token.trim();
  for (const prefix of ["rb-auth-", "rb-admin-"] as const) {
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length, prefix.length + 8);
    }
  }
  return trimmed.slice(0, 8);
}

export function looksLikeRelaybaseAuthToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("rb-auth-") || trimmed.startsWith("rb-admin-");
}

export function isPlaceholderWorkerServiceToken(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    trimmed === "rb-admin-temp-replace-me" ||
    trimmed.includes("replace-me") ||
    trimmed.includes("temp-replace") ||
    trimmed.includes("changeme")
  );
}

function migrateCloudflareFromMacPurity(): Pick<
  EmailSenderSettings,
  "cloudflareAccountId" | "cloudflareApiToken"
> | null {
  try {
    const macpurity = readEmailSettings("macpurity");
    const accountId = macpurity.cloudflareAccountId?.trim() ?? "";
    const apiToken = macpurity.cloudflareApiToken?.trim() ?? "";
    if (!accountId || !apiToken) return null;
    return { cloudflareAccountId: accountId, cloudflareApiToken: apiToken };
  } catch {
    return null;
  }
}

function mergeSettingsWithEnv(stored: EmailSenderSettings): EmailSenderSettings {
  const env = readRelaybaseEnvSettings();
  return {
    ...stored,
    workerUrl: resolveSettingValue("workerUrl", stored.workerUrl, env),
    cloudflareAccountId: resolveSettingValue(
      "cloudflareAccountId",
      stored.cloudflareAccountId,
      env,
    ),
    cloudflareApiToken: resolveSettingValue(
      "cloudflareApiToken",
      stored.cloudflareApiToken,
      env,
    ),
    cloudflareZoneId: resolveSettingValue(
      "cloudflareZoneId",
      stored.cloudflareZoneId,
      env,
    ),
    cloudflareDnsApiToken: resolveSettingValue(
      "cloudflareDnsApiToken",
      stored.cloudflareDnsApiToken,
      env,
    ),
    inboundR2BucketName: resolveInboundR2BucketName(
      RELAYBASE_STORE_ID,
      resolveSettingValue(
        "inboundR2BucketName",
        stored.inboundR2BucketName,
        env,
      ),
    ),
  };
}

async function readStoredSettings(): Promise<EmailSenderSettings | null> {
  let stored = await readProductJson<StoredEmailSenderSettings>(
    RELAYBASE_STORE_ID,
    SETTINGS_FILE,
  );
  if (stored) return normalizeStoredSettings(stored);

  for (const legacyId of LEGACY_STORE_IDS) {
    stored = await readProductJson<StoredEmailSenderSettings>(
      legacyId,
      SETTINGS_FILE,
    );
    if (stored) {
      const normalized = normalizeStoredSettings(stored);
      await writeEmailSenderSettings(normalized);
      return normalized;
    }
  }
  return null;
}

export async function readEmailSenderSettings(): Promise<EmailSenderSettings> {
  const stored = await readStoredSettings();
  if (stored) {
    let next = stored;
    const env = readRelaybaseEnvSettings();
    if (
      (!next.cloudflareAccountId || !next.cloudflareApiToken) &&
      !env.sources.cloudflareAccountId &&
      !env.sources.cloudflareApiToken
    ) {
      const macpurity = migrateCloudflareFromMacPurity();
      if (macpurity) {
        next = { ...next, ...macpurity };
        await writeEmailSenderSettings(next);
      }
    }
    return mergeSettingsWithEnv(next);
  }
  return mergeSettingsWithEnv(emptySettings());
}

export async function writeEmailSenderSettings(
  settings: EmailSenderSettings,
): Promise<string> {
  return writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, {
    workerUrl: settings.workerUrl.trim().replace(/\/$/, ""),
    adminToken: settings.adminToken.trim(),
    cloudflareAccountId: settings.cloudflareAccountId.trim(),
    cloudflareApiToken: settings.cloudflareApiToken.trim(),
    cloudflareZoneId: settings.cloudflareZoneId.trim(),
    cloudflareDnsApiToken: settings.cloudflareDnsApiToken.trim(),
    inboundR2BucketName: settings.inboundR2BucketName.trim(),
    domainBranding: settings.domainBranding,
    apiKeyVault: settings.apiKeyVault,
    sentEmails: settings.sentEmails,
    dashboardAuthTokens: settings.dashboardAuthTokens,
  });
}

export async function addEmailSenderKeyToVault(
  record: EmailSenderApiKeyRecord,
): Promise<EmailSenderSettings> {
  const current = await readEmailSenderSettings();
  const vault = [
    ...current.apiKeyVault.filter((k) => k.id !== record.id),
    record,
  ];
  const next = { ...current, apiKeyVault: vault };
  await writeEmailSenderSettings(next);
  return next;
}

export async function removeEmailSenderKeyFromVault(
  keyId: string,
): Promise<EmailSenderSettings> {
  const current = await readEmailSenderSettings();
  const next = {
    ...current,
    apiKeyVault: current.apiKeyVault.filter((k) => k.id !== keyId),
  };
  await writeEmailSenderSettings(next);
  return next;
}

export async function recordEmailSenderSentEmail(
  entry: Omit<EmailSenderSentRecord, "id" | "sentAt"> & {
    id?: string;
    sentAt?: string;
  },
): Promise<EmailSenderSentRecord> {
  const current = await readEmailSenderSettings();
  const record: EmailSenderSentRecord = {
    id: entry.id ?? crypto.randomUUID(),
    sentAt: entry.sentAt ?? new Date().toISOString(),
    keyId: entry.keyId,
    keyLabel: entry.keyLabel,
    domain: entry.domain,
    from: entry.from,
    to: entry.to,
    subject: entry.subject,
    bodyPreview: entry.bodyPreview.slice(0, 500),
    messageId: entry.messageId,
  };
  const sentEmails = [record, ...current.sentEmails].slice(0, 200);
  await writeEmailSenderSettings({ ...current, sentEmails });
  return record;
}

export async function listEmailSenderSentEmails(): Promise<
  EmailSenderSentRecord[]
> {
  return (await readEmailSenderSettings()).sentEmails;
}

export async function getEmailSenderVaultKey(
  keyId: string,
): Promise<EmailSenderApiKeyRecord | null> {
  return (
    (await readEmailSenderSettings()).apiKeyVault.find(
      (entry) => entry.id === keyId,
    ) ?? null
  );
}

export async function mergeEmailSenderSettings(
  patch: Partial<EmailSenderSettings>,
): Promise<EmailSenderSettings> {
  const current = await readEmailSenderSettings();
  const next: EmailSenderSettings = { ...current };
  if (patch.workerUrl !== undefined) {
    next.workerUrl = patch.workerUrl.trim().replace(/\/$/, "");
  }
  if (patch.adminToken !== undefined && patch.adminToken.trim()) {
    next.adminToken = patch.adminToken.trim();
  }
  if (patch.cloudflareAccountId !== undefined) {
    next.cloudflareAccountId = patch.cloudflareAccountId.trim();
  }
  if (patch.cloudflareApiToken !== undefined && patch.cloudflareApiToken.trim()) {
    next.cloudflareApiToken = patch.cloudflareApiToken.trim();
  }
  if (patch.cloudflareZoneId !== undefined) {
    next.cloudflareZoneId = patch.cloudflareZoneId.trim();
  }
  if (patch.cloudflareDnsApiToken !== undefined) {
    next.cloudflareDnsApiToken = patch.cloudflareDnsApiToken.trim();
  }
  if (patch.inboundR2BucketName !== undefined) {
    next.inboundR2BucketName = resolveInboundR2BucketName(
      RELAYBASE_STORE_ID,
      patch.inboundR2BucketName,
    );
  }
  if (patch.domainBranding !== undefined) {
    next.domainBranding = patch.domainBranding;
  }
  if (patch.dashboardAuthTokens !== undefined) {
    next.dashboardAuthTokens = patch.dashboardAuthTokens;
  }
  await writeEmailSenderSettings(next);
  return next;
}

export async function getEmailSenderSettingsView(): Promise<EmailSenderSettingsView> {
  return toEmailSenderSettingsView(await readEmailSenderSettings());
}

/** Settings view with env-first resolution for dashboard display. */
export async function getEmailSenderConnectionView(): Promise<EmailSenderSettingsView> {
  return toEmailSenderSettingsView(await readEmailSenderSettings());
}

export function toEmailSenderSettingsView(
  settings: EmailSenderSettings,
): EmailSenderSettingsView {
  const workerUrl = settings.workerUrl.trim();
  const cloudflareConfigured = Boolean(
    settings.cloudflareAccountId.trim() && settings.cloudflareApiToken.trim(),
  );
  const workerLinked = Boolean(
    settings.adminToken.trim() && !looksLikeCloudflareApiToken(settings.adminToken),
  );
  return {
    workerUrl,
    cloudflareConfigured,
    configured: Boolean(workerUrl && cloudflareConfigured),
    workerLinked,
  };
}

export type EmailSenderAdminConfigDetail = EmailSenderSettingsView & {
  cloudflareAccountId: string;
  cloudflareZoneId: string;
  inboundR2BucketName: string;
  cloudflareApiToken: string;
  cloudflareDnsApiToken: string;
  envSources: RelaybaseEnvSources;
};

/** Full settings for admin UI — includes stored credentials for confirmation. */
export async function getEmailSenderAdminSettingsDetail(): Promise<EmailSenderAdminConfigDetail> {
  const settings = await readEmailSenderSettings();
  const connection = await getEmailSenderConnectionView();
  const env = readRelaybaseEnvSettings();
  return {
    ...connection,
    cloudflareAccountId: settings.cloudflareAccountId.trim(),
    cloudflareZoneId: settings.cloudflareZoneId.trim(),
    inboundR2BucketName: resolveInboundR2BucketName(
      RELAYBASE_STORE_ID,
      settings.inboundR2BucketName,
    ),
    cloudflareApiToken: settings.cloudflareApiToken.trim(),
    cloudflareDnsApiToken: settings.cloudflareDnsApiToken.trim(),
    envSources: env.sources,
  };
}

export type RelaybaseDashboardAuthTokenView = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

/** @deprecated Use RelaybaseDashboardAuthTokenView */
export type RelaybaseDashboardAdminTokenView = RelaybaseDashboardAuthTokenView;

export async function listRelaybaseDashboardAuthTokens(): Promise<
  RelaybaseDashboardAuthTokenView[]
> {
  return (await readEmailSenderSettings()).dashboardAuthTokens.map((entry) => ({
    id: entry.id,
    label: entry.label,
    productId: entry.productId,
    tokenPrefix: entry.tokenPrefix,
    createdAt: entry.createdAt,
  }));
}

/** @deprecated Use listRelaybaseDashboardAuthTokens */
export const listRelaybaseDashboardAdminTokens = listRelaybaseDashboardAuthTokens;

export async function issueRelaybaseDashboardAuthToken(params?: {
  label?: string;
  productId?: string;
}): Promise<{ record: RelaybaseDashboardAuthTokenRecord; token: string }> {
  const token = generateRelaybaseAuthToken();
  const record: RelaybaseDashboardAuthTokenRecord = {
    id: crypto.randomUUID(),
    label: params?.label?.trim() || null,
    productId: params?.productId?.trim() || null,
    tokenPrefix: relaybaseAuthTokenPrefix(token),
    token,
    createdAt: new Date().toISOString(),
  };
  const current = await readEmailSenderSettings();
  await writeEmailSenderSettings({
    ...current,
    dashboardAuthTokens: [...current.dashboardAuthTokens, record],
  });
  return { record, token };
}

/** @deprecated Use issueRelaybaseDashboardAuthToken */
export const issueRelaybaseDashboardAdminToken = issueRelaybaseDashboardAuthToken;

export async function revokeRelaybaseDashboardAuthToken(
  id: string,
): Promise<boolean> {
  const current = await readEmailSenderSettings();
  const next = current.dashboardAuthTokens.filter((entry) => entry.id !== id);
  if (next.length === current.dashboardAuthTokens.length) return false;
  await writeEmailSenderSettings({ ...current, dashboardAuthTokens: next });
  return true;
}

/** @deprecated Use revokeRelaybaseDashboardAuthToken */
export const revokeRelaybaseDashboardAdminToken = revokeRelaybaseDashboardAuthToken;

export async function findRelaybaseDashboardAuthToken(
  token: string,
): Promise<RelaybaseDashboardAuthTokenRecord | null> {
  const trimmed = token.trim();
  if (!trimmed || looksLikeCloudflareApiToken(trimmed)) return null;
  if (!looksLikeRelaybaseAuthToken(trimmed)) return null;
  return (
    (await readEmailSenderSettings()).dashboardAuthTokens.find(
      (entry) => entry.token === trimmed,
    ) ?? null
  );
}

/** @deprecated Use findRelaybaseDashboardAuthToken */
export const findRelaybaseDashboardAdminToken = findRelaybaseDashboardAuthToken;

export async function isValidRelaybaseAuthCredential(
  token: string,
): Promise<boolean> {
  return (await findRelaybaseDashboardAuthToken(token)) !== null;
}

/** @deprecated Use isValidRelaybaseAuthCredential */
export const isValidRelaybaseAdminCredential = isValidRelaybaseAuthCredential;
