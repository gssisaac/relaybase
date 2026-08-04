import {
  generateWorkerServiceToken,
  isPlaceholderWorkerServiceToken,
  looksLikeCloudflareApiToken,
  mergeEmailSenderSettings,
  readEmailSenderSettings,
} from "./settings";

export type EmailSenderConfig = {
  baseUrl: string;
  adminToken: string;
};

/** Internal worker bridge token — auto-provisioned on save, not user-facing. */
export async function ensureWorkerServiceToken(): Promise<string> {
  const existing = await resolveWorkerServiceToken();
  if (
    existing &&
    !looksLikeCloudflareApiToken(existing) &&
    !isPlaceholderWorkerServiceToken(existing)
  ) {
    return existing;
  }
  const token = generateWorkerServiceToken();
  await mergeEmailSenderSettings({ adminToken: token });
  return token;
}

export async function resolveWorkerServiceToken(): Promise<string> {
  const settings = await readEmailSenderSettings();
  const fromSettings = settings.adminToken.trim();
  if (fromSettings && !looksLikeCloudflareApiToken(fromSettings)) {
    return fromSettings;
  }
  return fromSettings;
}

/** @deprecated Use resolveWorkerServiceToken */
export const resolveAdminTokenFromSettings = resolveWorkerServiceToken;

export async function resolveEmailSenderConfig(): Promise<EmailSenderConfig | null> {
  const settings = await readEmailSenderSettings();
  const baseUrl = settings.workerUrl.trim();
  const adminToken = await resolveWorkerServiceToken();
  if (!baseUrl || !adminToken) return null;
  return { baseUrl, adminToken };
}

export async function requireEmailSenderConfig(): Promise<EmailSenderConfig> {
  const cfg = await resolveEmailSenderConfig();
  if (!cfg) {
    throw new Error(
      "Relaybase is not configured — set the worker URL and Cloudflare credentials in Settings, then save",
    );
  }
  return cfg;
}
