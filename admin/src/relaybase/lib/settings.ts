import { randomBytes } from "node:crypto";

import {
  readProductJson,
  writeProductJson,
} from "@/lib/config/product-store";
import { defaultInboundR2BucketName, resolveInboundR2BucketName } from "@/relaybase-email/lib/r2-inbound";
import { readEmailSettings } from "@/relaybase-email/lib/email-settings";

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

/** Dashboard access token issued from Relaybase — not a Cloudflare API token (cfut_…). */
export type RelaybaseDashboardAdminTokenRecord = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  token: string;
  createdAt: string;
};

export type EmailSenderSettings = {
  workerUrl: string;
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
  dashboardAdminTokens: RelaybaseDashboardAdminTokenRecord[];
};

export type DomainBrandingConfig = {
  dmarcPolicy: "none" | "quarantine" | "reject";
  dmarcRua: string;
  bimiLogoUrl: string;
};

export type EmailSenderSettingsView = {
  workerUrl: string;
  adminTokenConfigured: boolean;
  cloudflareConfigured: boolean;
  configured: boolean;
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
    dashboardAdminTokens: [],
  };
}

export function looksLikeCloudflareApiToken(value: string): boolean {
  return value.trim().startsWith("cfut_");
}

export function generateRelaybaseAdminToken(): string {
  return `rb-admin-${randomBytes(24).toString("hex")}`;
}

function relaybaseAdminTokenPrefix(token: string): string {
  const trimmed = token.trim();
  if (trimmed.startsWith("rb-admin-")) {
    return trimmed.slice("rb-admin-".length, "rb-admin-".length + 8);
  }
  return trimmed.slice(0, 8);
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

function readStoredSettings(): EmailSenderSettings | null {
  let stored = readProductJson<EmailSenderSettings>(
    RELAYBASE_STORE_ID,
    SETTINGS_FILE,
  );
  if (stored) return stored;

  for (const legacyId of LEGACY_STORE_IDS) {
    stored = readProductJson<EmailSenderSettings>(legacyId, SETTINGS_FILE);
    if (stored) {
      writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, stored);
      return stored;
    }
  }
  return null;
}

function migrateFromEnvIfNeeded(): EmailSenderSettings | null {
  const workerUrl =
    process.env.RELAYBASE_URL?.trim().replace(/\/$/, "") ??
    process.env.FLARE_EMAIL_SENDER_URL?.trim().replace(/\/$/, "") ??
    "";
  const adminToken =
    process.env.RELAYBASE_ADMIN_TOKEN?.trim() ??
    process.env.FLARE_EMAIL_SENDER_ADMIN_TOKEN?.trim() ??
    "";
  if (!workerUrl && !adminToken) return null;
  const cfFromEnv = {
    cloudflareAccountId:
      process.env.FLARE_EMAIL_SENDER_CF_ACCOUNT_ID?.trim() ??
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ??
      "",
    cloudflareApiToken:
      process.env.FLARE_EMAIL_SENDER_CF_API_TOKEN?.trim() ??
      process.env.CLOUDFLARE_API_TOKEN?.trim() ??
      "",
  };
  const macpurity = migrateCloudflareFromMacPurity();
  return {
    workerUrl,
    adminToken,
    cloudflareAccountId:
      cfFromEnv.cloudflareAccountId || macpurity?.cloudflareAccountId || "",
    cloudflareApiToken:
      cfFromEnv.cloudflareApiToken || macpurity?.cloudflareApiToken || "",
    cloudflareZoneId: "",
    cloudflareDnsApiToken: "",
    inboundR2BucketName: defaultInboundR2BucketName(RELAYBASE_STORE_ID),
    domainBranding: {},
    apiKeyVault: [],
    sentEmails: [],
    dashboardAdminTokens: [],
  };
}

export function readEmailSenderSettings(): EmailSenderSettings {
  let stored = readStoredSettings();
  if (!stored) {
    const migrated = migrateFromEnvIfNeeded();
    if (migrated) {
      writeEmailSenderSettings(migrated);
      stored = migrated;
    }
  }
  if (stored) {
    let next: EmailSenderSettings = {
      workerUrl: stored.workerUrl?.trim().replace(/\/$/, "") ?? "",
      adminToken: stored.adminToken?.trim() ?? "",
      cloudflareAccountId: stored.cloudflareAccountId?.trim() ?? "",
      cloudflareApiToken: stored.cloudflareApiToken?.trim() ?? "",
      cloudflareZoneId: stored.cloudflareZoneId?.trim() ?? "",
      cloudflareDnsApiToken: stored.cloudflareDnsApiToken?.trim() ?? "",
      inboundR2BucketName: resolveInboundR2BucketName(
        RELAYBASE_STORE_ID,
        stored.inboundR2BucketName,
      ),
      domainBranding: stored.domainBranding ?? {},
      apiKeyVault: stored.apiKeyVault ?? [],
      sentEmails: stored.sentEmails ?? [],
      dashboardAdminTokens: stored.dashboardAdminTokens ?? [],
    };
    if (!next.cloudflareAccountId || !next.cloudflareApiToken) {
      const macpurity = migrateCloudflareFromMacPurity();
      if (macpurity) {
        next = { ...next, ...macpurity };
        writeEmailSenderSettings(next);
      }
    }
    return next;
  }
  return emptySettings();
}

export function writeEmailSenderSettings(
  settings: EmailSenderSettings,
): string {
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
    dashboardAdminTokens: settings.dashboardAdminTokens,
  });
}

export function addEmailSenderKeyToVault(
  record: EmailSenderApiKeyRecord,
): EmailSenderSettings {
  const current = readEmailSenderSettings();
  const vault = [
    ...current.apiKeyVault.filter((k) => k.id !== record.id),
    record,
  ];
  const next = { ...current, apiKeyVault: vault };
  writeEmailSenderSettings(next);
  return next;
}

export function removeEmailSenderKeyFromVault(
  keyId: string,
): EmailSenderSettings {
  const current = readEmailSenderSettings();
  const next = {
    ...current,
    apiKeyVault: current.apiKeyVault.filter((k) => k.id !== keyId),
  };
  writeEmailSenderSettings(next);
  return next;
}

export function recordEmailSenderSentEmail(
  entry: Omit<EmailSenderSentRecord, "id" | "sentAt"> & {
    id?: string;
    sentAt?: string;
  },
): EmailSenderSentRecord {
  const current = readEmailSenderSettings();
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
  writeEmailSenderSettings({ ...current, sentEmails });
  return record;
}

export function listEmailSenderSentEmails(): EmailSenderSentRecord[] {
  return readEmailSenderSettings().sentEmails;
}

export function getEmailSenderVaultKey(
  keyId: string,
): EmailSenderApiKeyRecord | null {
  return (
    readEmailSenderSettings().apiKeyVault.find((entry) => entry.id === keyId) ??
    null
  );
}

export function mergeEmailSenderSettings(
  patch: Partial<EmailSenderSettings>,
): EmailSenderSettings {
  const current = readEmailSenderSettings();
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
  writeEmailSenderSettings(next);
  return next;
}

export function toEmailSenderSettingsView(
  settings: EmailSenderSettings,
): EmailSenderSettingsView {
  const workerUrl = settings.workerUrl.trim();
  const adminTokenConfigured = Boolean(settings.adminToken.trim());
  const cloudflareConfigured = Boolean(
    settings.cloudflareAccountId.trim() && settings.cloudflareApiToken.trim(),
  );
  return {
    workerUrl,
    adminTokenConfigured,
    cloudflareConfigured,
    configured: Boolean(workerUrl && adminTokenConfigured && cloudflareConfigured),
  };
}

export function getEmailSenderSettingsView(): EmailSenderSettingsView {
  return toEmailSenderSettingsView(readEmailSenderSettings());
}

/** Settings view with env fallback for dashboard display. */
export function getEmailSenderConnectionView(): EmailSenderSettingsView {
  const settings = readEmailSenderSettings();
  const stored = toEmailSenderSettingsView(settings);
  const workerUrl =
    stored.workerUrl ||
    process.env.RELAYBASE_URL?.trim().replace(/\/$/, "") ||
    process.env.FLARE_EMAIL_SENDER_URL?.trim().replace(/\/$/, "") ||
    "";
  const adminToken =
    (settings.adminToken.trim().startsWith("cfut_")
      ? ""
      : settings.adminToken.trim()) ||
    process.env.RELAYBASE_ADMIN_TOKEN?.trim() ||
    process.env.FLARE_EMAIL_SENDER_ADMIN_TOKEN?.trim() ||
    "";
  const adminTokenConfigured = Boolean(adminToken);
  const cloudflareConfigured = stored.cloudflareConfigured;
  return {
    workerUrl,
    adminTokenConfigured,
    cloudflareConfigured,
    configured: Boolean(
      workerUrl && adminTokenConfigured && cloudflareConfigured,
    ),
  };
}

export type EmailSenderAdminConfigDetail = EmailSenderSettingsView & {
  cloudflareAccountId: string;
  cloudflareZoneId: string;
  inboundR2BucketName: string;
  cloudflareApiToken: string;
  cloudflareDnsApiToken: string;
};

/** Full settings for admin UI — includes stored credentials for confirmation. */
export function getEmailSenderAdminSettingsDetail(): EmailSenderAdminConfigDetail {
  const settings = readEmailSenderSettings();
  const connection = getEmailSenderConnectionView();
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
  };
}

export type RelaybaseDashboardAdminTokenView = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

export function listRelaybaseDashboardAdminTokens(): RelaybaseDashboardAdminTokenView[] {
  return readEmailSenderSettings().dashboardAdminTokens.map((entry) => ({
    id: entry.id,
    label: entry.label,
    productId: entry.productId,
    tokenPrefix: entry.tokenPrefix,
    createdAt: entry.createdAt,
  }));
}

export function issueRelaybaseDashboardAdminToken(params?: {
  label?: string;
  productId?: string;
}): { record: RelaybaseDashboardAdminTokenRecord; token: string } {
  const token = generateRelaybaseAdminToken();
  const record: RelaybaseDashboardAdminTokenRecord = {
    id: crypto.randomUUID(),
    label: params?.label?.trim() || null,
    productId: params?.productId?.trim() || null,
    tokenPrefix: relaybaseAdminTokenPrefix(token),
    token,
    createdAt: new Date().toISOString(),
  };
  const current = readEmailSenderSettings();
  writeEmailSenderSettings({
    ...current,
    dashboardAdminTokens: [...current.dashboardAdminTokens, record],
  });
  return { record, token };
}

export function revokeRelaybaseDashboardAdminToken(id: string): boolean {
  const current = readEmailSenderSettings();
  const next = current.dashboardAdminTokens.filter((entry) => entry.id !== id);
  if (next.length === current.dashboardAdminTokens.length) return false;
  writeEmailSenderSettings({ ...current, dashboardAdminTokens: next });
  return true;
}

export function findRelaybaseDashboardAdminToken(
  token: string,
): RelaybaseDashboardAdminTokenRecord | null {
  const trimmed = token.trim();
  if (!trimmed || looksLikeCloudflareApiToken(trimmed)) return null;
  return (
    readEmailSenderSettings().dashboardAdminTokens.find(
      (entry) => entry.token === trimmed,
    ) ?? null
  );
}

export function isValidRelaybaseAdminCredential(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed || looksLikeCloudflareApiToken(trimmed)) return false;
  return findRelaybaseDashboardAdminToken(trimmed) !== null;
}
