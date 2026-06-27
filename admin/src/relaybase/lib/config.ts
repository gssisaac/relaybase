import {
  generateRelaybaseAdminToken,
  looksLikeCloudflareApiToken,
  mergeEmailSenderSettings,
  readEmailSenderSettings,
} from "./settings";

export type EmailSenderConfig = {
  baseUrl: string;
  adminToken: string;
};

/** Internal worker bridge token — auto-provisioned on save, not user-facing. */
export function ensureWorkerServiceToken(): string {
  const existing = resolveAdminTokenFromSettings();
  if (existing && !looksLikeCloudflareApiToken(existing)) {
    return existing;
  }
  const token = generateRelaybaseAdminToken();
  mergeEmailSenderSettings({ adminToken: token });
  return token;
}

export function resolveAdminTokenFromSettings(): string {
  const settings = readEmailSenderSettings();
  const fromSettings = settings.adminToken.trim();
  const fromEnv =
    process.env.RELAYBASE_ADMIN_TOKEN?.trim() ??
    process.env.FLARE_EMAIL_SENDER_ADMIN_TOKEN?.trim() ??
    "";

  if (fromSettings && !looksLikeCloudflareApiToken(fromSettings)) {
    return fromSettings;
  }
  return fromEnv || fromSettings;
}

export function resolveEmailSenderConfig(): EmailSenderConfig | null {
  const settings = readEmailSenderSettings();
  const baseUrl =
    settings.workerUrl.trim() ||
    process.env.RELAYBASE_URL?.trim().replace(/\/$/, "") ||
    process.env.FLARE_EMAIL_SENDER_URL?.trim().replace(/\/$/, "") ||
    "";
  const adminToken = resolveAdminTokenFromSettings();
  if (!baseUrl || !adminToken) return null;
  return { baseUrl, adminToken };
}

export function requireEmailSenderConfig(): EmailSenderConfig {
  const cfg = resolveEmailSenderConfig();
  if (!cfg) {
    throw new Error(
      "Relaybase is not configured — set the worker URL and Cloudflare credentials in Settings, then save",
    );
  }
  return cfg;
}
