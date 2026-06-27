import {
  generateWorkerServiceToken,
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
  const existing = resolveWorkerServiceToken();
  if (existing && !looksLikeCloudflareApiToken(existing)) {
    return existing;
  }
  const token = generateWorkerServiceToken();
  mergeEmailSenderSettings({ adminToken: token });
  return token;
}

export function resolveWorkerServiceToken(): string {
  const settings = readEmailSenderSettings();
  const fromSettings = settings.adminToken.trim();
  if (fromSettings && !looksLikeCloudflareApiToken(fromSettings)) {
    return fromSettings;
  }
  return fromSettings;
}

/** @deprecated Use resolveWorkerServiceToken */
export const resolveAdminTokenFromSettings = resolveWorkerServiceToken;

export function resolveEmailSenderConfig(): EmailSenderConfig | null {
  const settings = readEmailSenderSettings();
  const baseUrl = settings.workerUrl.trim();
  const adminToken = resolveWorkerServiceToken();
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
