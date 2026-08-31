import {
  readProductJson,
  writeProductJson,
} from "@/lib/config/product-store";
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

/**
 * Operator config for the Relaybase product worker. Only the bits the
 * operator dashboard needs to reach the worker and authorize calls live
 * here — Cloudflare credentials, DMARC branding, and send logs now live on
 * the product worker (wrangler secrets + D1 `domain_branding` +
 * R2 `sent/_sendlog/*`).
 */
export type EmailSenderSettings = {
  /** Product worker URL (e.g. https://relaybase-api.<subdomain>.workers.dev). */
  workerUrl: string;
  /**
   * Internal worker bridge token. Must match the worker's `ADMIN_TOKEN`
   * wrangler secret (set via the desktop install flow).
   */
  adminToken: string;
};

type StoredEmailSenderSettings = EmailSenderSettings & {
  // Legacy fields kept for migration reading only — never written back.
  workerScriptName?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareZoneId?: string;
  cloudflareDnsApiToken?: string;
  inboundR2BucketName?: string;
  domainBranding?: unknown;
  sentEmails?: unknown;
  dashboardAdminTokens?: unknown;
  apiKeyVault?: unknown;
  dashboardAuthTokens?: unknown;
};

export type EmailSenderSettingsView = {
  workerUrl: string;
  /** Worker URL + admin token are set (env or stored). */
  configured: boolean;
  /** Worker accepts the stored admin token. */
  workerLinked: boolean;
};

function emptySettings(): EmailSenderSettings {
  return {
    workerUrl: "",
    adminToken: "",
  };
}

function normalizeStoredSettings(
  raw: StoredEmailSenderSettings,
): EmailSenderSettings {
  return {
    workerUrl: raw.workerUrl?.trim().replace(/\/$/, "") ?? "",
    adminToken: raw.adminToken?.trim() ?? "",
  };
}

export function looksLikeCloudflareApiToken(value: string): boolean {
  return value.trim().startsWith("cfut_");
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

function mergeSettingsWithEnv(
  stored: EmailSenderSettings,
): EmailSenderSettings {
  const env = readRelaybaseEnvSettings();
  return {
    ...stored,
    workerUrl: resolveSettingValue("workerUrl", stored.workerUrl, env),
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
    return mergeSettingsWithEnv(stored);
  }
  return mergeSettingsWithEnv(emptySettings());
}

export async function writeEmailSenderSettings(
  settings: EmailSenderSettings,
): Promise<string> {
  return writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, {
    workerUrl: settings.workerUrl.trim().replace(/\/$/, ""),
    adminToken: settings.adminToken.trim(),
  });
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
  const workerLinked = Boolean(
    settings.adminToken.trim() && !looksLikeCloudflareApiToken(settings.adminToken),
  );
  return {
    workerUrl,
    configured: Boolean(workerUrl && settings.adminToken.trim()),
    workerLinked,
  };
}

export type EmailSenderAdminConfigDetail = EmailSenderSettingsView & {
  adminToken: string;
  envSources: RelaybaseEnvSources;
};

/** Full settings for admin UI — includes the admin token for confirmation. */
export async function getEmailSenderAdminSettingsDetail(): Promise<EmailSenderAdminConfigDetail> {
  const settings = await readEmailSenderSettings();
  const connection = await getEmailSenderConnectionView();
  const env = readRelaybaseEnvSettings();
  return {
    ...connection,
    adminToken: settings.adminToken.trim(),
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

// Dashboard auth-token issuance, listing, revocation, and verification now live
// in the product Worker (`/console/auth-tokens`) so end-user credentials are not
// stored in HQ ops D1. See `./auth-token-client.ts` for the Worker wrapper.
