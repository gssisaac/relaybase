/** Minimal stubs for admin branding / Cloudflare helpers. */

export function readEmailSettings(_productId: string) {
  return {
    cloudflareAccountId: "",
    cloudflareApiToken: "",
    cloudflareDnsApiToken: "",
    cloudflareApiEmail: "",
    cloudflareGlobalApiKey: "",
    relaybaseAdminToken: "",
  };
}

export function resolveEmailCloudflareConfig(_serviceId: string) {
  return null as {
    accountId: string;
    apiToken: string;
  } | null;
}
