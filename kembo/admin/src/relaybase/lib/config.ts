import {
  isPlaceholderWorkerServiceToken,
  looksLikeCloudflareApiToken,
  readEmailSenderSettings,
} from "./settings";

export type EmailSenderConfig = {
  baseUrl: string;
  adminToken: string;
};

/** Resolve the stored worker bridge token (operator-entered). */
export async function resolveWorkerServiceToken(): Promise<string> {
  const settings = await readEmailSenderSettings();
  return settings.adminToken.trim();
}

/** @deprecated Use resolveWorkerServiceToken */
export const resolveAdminTokenFromSettings = resolveWorkerServiceToken;

export async function resolveEmailSenderConfig(): Promise<EmailSenderConfig | null> {
  const settings = await readEmailSenderSettings();
  const baseUrl = settings.workerUrl.trim();
  const adminToken = await resolveWorkerServiceToken();
  if (
    !baseUrl ||
    !adminToken ||
    looksLikeCloudflareApiToken(adminToken) ||
    isPlaceholderWorkerServiceToken(adminToken)
  ) {
    return null;
  }
  return { baseUrl, adminToken };
}

export async function requireEmailSenderConfig(): Promise<EmailSenderConfig> {
  const cfg = await resolveEmailSenderConfig();
  if (!cfg) {
    throw new Error(
      "Relaybase is not configured — set the worker URL and admin token in Settings, then save",
    );
  }
  return cfg;
}
