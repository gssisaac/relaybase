import { readEmailSenderSettings } from "./settings";

export type EmailSenderConfig = {
  baseUrl: string;
};

export async function resolveEmailSenderConfig(): Promise<EmailSenderConfig | null> {
  const settings = await readEmailSenderSettings();
  const baseUrl = settings.workerUrl.trim();
  if (!baseUrl) return null;
  return { baseUrl };
}

export async function requireEmailSenderConfig(): Promise<EmailSenderConfig> {
  throw new Error(
    "HQ admin no longer authenticates to the product Worker. Use the desktop app with an owner passtoken.",
  );
}
