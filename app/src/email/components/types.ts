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
  onboarding?: {
    status: string;
    currentStep: string | null;
    lastError: string | null;
    steps: Array<{
      id: string;
      label: string;
      status: string;
      error?: string | null;
      updatedAt?: string;
    }>;
  } | null;
};

export type Address = {
  email: string;
  domain?: string;
  displayName?: string;
};

export type RoutingActivityEvent = {
  key: string;
  fromEmail: string;
  toEmail: string;
  /** All To recipients from MIME headers when available. */
  toEmails?: string[];
  /** Cc recipients from MIME headers when available. */
  ccEmails?: string[];
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
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
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
  inReplyTo?: string;
  references?: string;
  /** Parent inbox message key when this was sent as a reply. */
  replyKey?: string;
};

export type DraftEmail = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** When set, this is a reply draft tied to an inbox message. */
  replyKey?: string;
  replyAll?: boolean;
  /** When set, this is a forward draft tied to an inbox message. */
  forwardKey?: string;
};

export type MailListItem =
  | { kind: "inbox"; id: string; message: RoutingActivityEvent }
  | { kind: "sent"; id: string; message: SentEmail }
  | { kind: "draft"; id: string; message: DraftEmail };

export type AudienceContact = {
  email: string;
  name?: string;
};

export type AudienceDataSourceType = "generic_json";

export type AudienceDataSource = {
  type: AudienceDataSourceType;
  endpointUrl: string;
  credential?: string;
  credentialHeader?: string;
};

export type AudienceSyncPhase =
  | "idle"
  | "fetching"
  | "parsing"
  | "writing"
  | "done";

export type AudienceSyncRunStatus = "running" | "success" | "error";

export type AudienceSyncRun = {
  id: string;
  trigger: "manual" | "cron";
  status: AudienceSyncRunStatus;
  phase: AudienceSyncPhase;
  startedAt: string;
  finishedAt?: string;
  totalCount?: number;
  processedCount?: number;
  skippedCount?: number;
  successCount?: number;
  failedCount?: number;
  error?: string;
  estimatedRemainingMs?: number;
};

export type AudienceGroupProgress = {
  groupId: string;
  cronEnabled: boolean;
  cronIntervalMinutes?: number;
  nextDueAt: string | null;
  lastSyncAt?: string;
  progress: AudienceSyncRun | null;
  history: AudienceSyncRun[];
};

export type AudienceGroupSummary = {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  contactCount: number;
  defaultFrom?: string;
  dataSource?: AudienceDataSource;
  cronEnabled?: boolean;
  cronIntervalMinutes?: number;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "error";
  lastSyncError?: string;
  lastSyncCount?: number;
  syncProgress?: AudienceSyncRun;
  syncHistory?: AudienceSyncRun[];
};

export type AudienceGroupContact = {
  id: string;
  email: string;
  name?: string;
  domain: string;
  groupId: string;
  source: "manual" | "synced";
  addedAt: string;
};

export type BroadcastSendPhase = "preparing" | "sending" | "done";

export type BroadcastSendRunStatus = "running" | "success" | "error";

export type BroadcastSendRun = {
  id: string;
  status: BroadcastSendRunStatus;
  phase: BroadcastSendPhase;
  startedAt: string;
  finishedAt?: string;
  totalCount?: number;
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  error?: string;
  estimatedRemainingMs?: number;
};

export type EmailBroadcast = {
  id: string;
  subject: string;
  body?: string;
  from?: string;
  createdAt: string;
  sentAt?: string;
  recipientCount?: number;
  /** draft | sending | sent | failed */
  status: string;
  groupIds: string[];
  domain?: string;
  sendProgress?: BroadcastSendRun;
  sendHistory?: BroadcastSendRun[];
};

export type BroadcastDetail = {
  broadcast: EmailBroadcast;
  groups: AudienceGroupSummary[];
  recipientCount: number;
};

export type BroadcastProgress = {
  broadcastId: string;
  status: string;
  progress: BroadcastSendRun | null;
  history: BroadcastSendRun[];
};
