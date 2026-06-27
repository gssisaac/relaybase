export type EmailConfig = {
  emailDomain: string;
  emailZoneId: string;
  relaybaseApiKey: string;
  relaybaseAuthToken: string;
  relaybaseKeyId: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  cloudflareDnsApiToken: string;
  cloudflareApiEmail: string;
  cloudflareGlobalApiKey: string;
  registeredAddresses: string[];
  audienceContacts: Array<{ email: string; name?: string }>;
  broadcasts: Array<{
    id: string;
    subject: string;
    body: string;
    from: string;
    createdAt: string;
    sentAt?: string;
    recipientCount: number;
    status: string;
  }>;
  configured: boolean;
  relaybaseConfigured: boolean;
  relaybaseAuthConfigured: boolean;
  cloudflareConfigured: boolean;
  relaybaseWorkerUrl: string;
  credentialSource: "integration" | "manual";
  usesIntegrationCredentials: boolean;
  domain: string;
  domains?: string[];
  activeDomain?: string | null;
  inboundR2BucketName?: string;
  inboundR2ObjectPrefix?: string;
  inboundR2BucketExists?: boolean;
  inboundR2WorkerConfigured?: boolean;
  inboundR2WorkerReady?: boolean;
  inboundR2WorkerBucketName?: string | null;
  inboundR2Mismatch?: boolean;
  inboundR2Configured?: boolean;
  limits?: EmailSendingLimits | null;
};

export type EmailSendingLimits = {
  configured: boolean;
  domain: string;
  sendingEnabled: boolean;
  routingEnabled: boolean;
  sendingSubdomainCount: number;
  destinationAddressCount: number;
  routingRuleCount: number;
  limitsUrl: string;
  pricingUrl: string;
};

export type DomainStatus = {
  domain: string;
  zoneId: string | null;
  cloudflareConfigured: boolean;
  sendingOnboarded: boolean;
  sendingEnabled: boolean;
  sendingDnsConfigured: boolean;
  routingEnabled: boolean;
  sendingSubdomainId: string | null;
  returnPathDomain: string | null;
  cloudflareSendingUrl: string | null;
  dnsRecords: Array<{
    type: string;
    name: string;
    expected: string;
    found: boolean;
  }>;
};

export type Address = {
  email: string;
};

export type RoutingActivityEvent = {
  key: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  status: string;
  action?: string;
  receivedAt: string;
  errorDetail?: string;
  bodyPreview?: string;
  bodyText?: string;
  bodyHtml?: string | null;
  attachmentCount?: number;
  attachments?: InboundAttachment[];
};

export type InboundAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string;
  contentId?: string | null;
};

/** @deprecated Use RoutingActivityEvent — kept for inbox list compatibility */
export type InboundMessage = RoutingActivityEvent & {
  bodyText?: string;
  bodyHtml?: string;
  fromName?: string;
};

export type SentEmail = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  bodyPreview: string;
  sentAt: string;
  messageId?: string;
};

export type MailListItem =
  | { kind: "inbox"; id: string; message: RoutingActivityEvent }
  | { kind: "sent"; id: string; message: SentEmail };

export type AudienceContact = {
  email: string;
  name?: string;
};

export type EmailBroadcast = {
  id: string;
  subject: string;
  body: string;
  from: string;
  createdAt: string;
  sentAt?: string;
  recipientCount: number;
  status: string;
};

export type EmailMetrics = {
  domain: string;
  relaybaseConfigured: boolean;
  cloudflareConfigured: boolean;
  sendingEnabled: boolean;
  routingEnabled: boolean;
  dnsOk: number;
  dnsTotal: number;
  routingActivityCount: number;
  audienceCount: number;
  senderCount: number;
  broadcastCount: number;
  broadcastsSent: number;
};
