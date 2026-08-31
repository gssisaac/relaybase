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
 * Operator config. HQ admin does not authenticate to the customer Worker.
 * product_settings may still hold a worker URL for display / public /health.
 */
export type EmailSenderSettings = {
  /** Product worker URL (e.g. https://relaybase-api.<subdomain>.workers.dev). */
  workerUrl: string;
};

type StoredEmailSenderSettings = EmailSenderSettings & {
  /** Ignored. HQ no longer stores a customer Worker credential. */
  adminToken?: string;
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
  configured: boolean;
  /** Always false — HQ no longer holds a customer Worker credential. */
  workerLinked: boolean;
};

function emptySettings(): EmailSenderSettings {
  return {
    workerUrl: "",
  };
}

function normalizeStoredSettings(
  raw: StoredEmailSenderSettings,
): EmailSenderSettings {
  return {
    workerUrl: raw.workerUrl?.trim().replace(/\/$/, "") ?? "",
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
  return {
    workerUrl,
    configured: Boolean(workerUrl),
    workerLinked: false,
  };
}

export type EmailSenderAdminConfigDetail = EmailSenderSettingsView & {
  envSources: RelaybaseEnvSources;
};

export async function getEmailSenderAdminSettingsDetail(): Promise<EmailSenderAdminConfigDetail> {
  const connection = await getEmailSenderConnectionView();
  const env = readRelaybaseEnvSettings();
  return {
    ...connection,
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
