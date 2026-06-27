import { loadProductEnv } from "@/lib/config/product-env";
import { readWebsiteSettings } from "@/lib/config/website-settings-stub";
import { CloudflareClient } from "@/lib/cloudflare/client";

import {
  readEmailSettings,
  resolveEmailCloudflareConfig,
} from "./email-settings";

export type EmailCloudflareCredentials = {
  accountId: string;
  apiToken: string;
  dnsApiToken: string;
  apiEmail: string;
  globalApiKey: string;
};

function envKey(serviceId: string, suffix: string): string {
  return `${serviceId.toUpperCase().replace(/-/g, "_")}_EMAIL_${suffix}`;
}

/** Email Sending/Routing — credentials from email.json, website settings, or env. */
export function resolveEmailCloudflareCredentials(
  serviceId: string,
): EmailCloudflareCredentials {
  loadProductEnv(serviceId);
  const cfg = resolveEmailCloudflareConfig(serviceId);
  if (!cfg) {
    throw new Error(
      "Cloudflare is not configured — set Account ID and API token in Email → Settings",
    );
  }
  const email = readEmailSettings(serviceId);
  const website = readWebsiteSettings(serviceId);

  const dnsApiToken =
    email.cloudflareDnsApiToken.trim() ||
    website.dnsApiToken.trim() ||
    process.env[envKey(serviceId, "CLOUDFLARE_DNS_API_TOKEN")]?.trim() ||
    cfg.apiToken;

  const apiEmail =
    email.cloudflareApiEmail.trim() ||
    website.apiEmail.trim() ||
    process.env[envKey(serviceId, "CLOUDFLARE_API_EMAIL")]?.trim() ||
    "";

  const globalApiKey =
    email.cloudflareGlobalApiKey.trim() ||
    website.globalApiKey.trim() ||
    process.env[envKey(serviceId, "CLOUDFLARE_GLOBAL_API_KEY")]?.trim() ||
    "";

  return {
    accountId: cfg.accountId,
    apiToken: cfg.apiToken,
    dnsApiToken,
    apiEmail,
    globalApiKey,
  };
}

export function createEmailCloudflareClient(serviceId: string): CloudflareClient {
  const creds = resolveEmailCloudflareCredentials(serviceId);
  return CloudflareClient.create(creds);
}

const CF_API_TOKENS_URL = "https://dash.cloudflare.com/profile/api-tokens";
const CF_CREATE_TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens?create=true";

function formatDnsAuthHelp(
  serviceId: string,
  creds: EmailCloudflareCredentials,
): string {
  const emailSettingsPath = `/products/${serviceId}/email/settings/aws`;
  const hasGlobal = Boolean(creds.apiEmail && creds.globalApiKey);
  const hasDnsToken = creds.dnsApiToken !== creds.apiToken;
  const hasEmailOnly = Boolean(creds.apiEmail && !creds.globalApiKey);

  if (hasEmailOnly) {
    return [
      "Cloudflare account email is set but Global API Key is missing.",
      "",
      "Copy your Global API Key from:",
      CF_API_TOKENS_URL,
      "",
      "Paste it into Global API Key on this page, then Save settings.",
    ].join("\n");
  }

  if (hasGlobal || hasDnsToken) {
    return [
      "DNS credentials are set but Cloudflare still rejected the request.",
      "",
      "Check the token or key is correct and includes Zone → DNS → Edit.",
      "",
      "Manage tokens:",
      CF_API_TOKENS_URL,
      "",
      "Update Email settings:",
      emailSettingsPath,
    ].join("\n");
  }

  return [
    "Your Email API token works for sending but not DNS (tokens without Zone → DNS cannot edit DNS records).",
    "",
    "Fix one of:",
    "",
    "1. Edit your existing API token — add permissions Zone → DNS → Edit and Zone → Zone → Read:",
    CF_API_TOKENS_URL,
    "",
    "2. Create a DNS-only API token (Zone → DNS → Edit) and paste it into “Cloudflare DNS API token” in Email settings:",
    CF_CREATE_TOKEN_URL,
    "",
    "3. Add your Cloudflare account email + Global API Key in Email → Domain connection:",
    CF_API_TOKENS_URL,
    emailSettingsPath,
  ].join("\n");
}

/** Prefix API error, then blank line, then multi-line help. */
export function formatCloudflareDnsError(
  serviceId: string,
  apiMessage: string,
  creds?: EmailCloudflareCredentials,
): string {
  const help = formatDnsAuthHelp(
    serviceId,
    creds ?? resolveEmailCloudflareCredentials(serviceId),
  );
  const detail = apiMessage.trim();
  if (!detail) return help;
  if (help.startsWith(detail) || detail.includes(help.slice(0, 40))) {
    return help;
  }
  return `${detail}\n\n${help}`;
}
