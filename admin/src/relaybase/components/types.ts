export type EmailSenderConfigStatus = {
  workerUrl: string;
  adminTokenConfigured: boolean;
  cloudflareConfigured: boolean;
  configured: boolean;
  healthy: boolean;
  inboundR2BucketName?: string;
  inboundR2WorkerReady?: boolean;
  inboundR2WorkerBucketName?: string | null;
  inboundR2Mismatch?: boolean;
  cloudflareAccountId?: string | null;
  cloudflareZoneId?: string | null;
  cloudflareApiToken?: string;
  cloudflareDnsApiToken?: string;
};

export type RelaybaseDashboardAdminTokenRow = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

export type EmailSenderKeyRow = {
  id: string;
  keyPrefix: string;
  domain: string;
  label: string | null;
  createdAt: string;
  active: boolean;
  apiKey: string | null;
  storedLocally: boolean;
};

export type EmailSenderKeyOption = {
  id: string;
  domain: string;
  label: string | null;
};

export type EmailSenderSentEmail = {
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

export type EmailSenderLogEntry = {
  id: string;
  at: string;
  ok: boolean;
  status: number;
  domain: string | null;
  keyId: string | null;
  keyPrefix: string | null;
  keyLabel: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  messageId?: string;
  error?: string;
};

export type EmailSenderLogSummary = {
  total: number;
  failed: number;
  failedLast24h: number;
};

export function integrationSnippet(workerUrl: string, domain: string) {
  const from = domain ? `billing@${domain}` : "billing@yourdomain.com";
  return `await fetch("${workerUrl}/v1/send", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.FLARE_EMAIL_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "${from}",
    to: "customer@example.com",
    subject: "Your invoice",
    text: "Your invoice is ready.",
  }),
});`;
}
