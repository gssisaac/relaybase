/**
 * Studio dev store types (`data/store.json` + `data/templates/*.yaml`).
 *
 * Layout — HTML frame · Template — message copy · Trigger — event send · Newsletter — audience send.
 */

// ============================================================================
// Core tenant & settings
// ============================================================================

export type AccountComplianceSettings = {
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  updatedAt: string;
};

export type ComplianceIdentity = {
  id: string;
  accountLinkId: string;
  name: string;
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountLink = {
  id: string;
  workerUrl: string | null;
  domain: string | null;
  sendApiKey?: string | null;
  compliance: AccountComplianceSettings;
  defaultComplianceIdentityId: string | null;
  createdAt: string;
};

// ============================================================================
// Layouts (HTML email frame)
// ============================================================================

export type LayoutVariableField = {
  key: string;
  type: "text" | "image";
  label: string;
  description?: string;
  required?: boolean;
  defaultFrom?: "compliance.organizationName";
};

export type LayoutVariablesSchema = {
  fields: LayoutVariableField[];
};

export type Layout = {
  id: string;
  accountLinkId: string | null;
  name: string;
  htmlSource: string;
  variablesSchema?: LayoutVariablesSchema | null;
  isBuiltin: boolean;
  derivedFromLayoutId?: string | null;
  createdAt: string;
};

// ============================================================================
// Templates (reusable message content — persisted as `data/templates/<id>.yaml` in dev)
// ============================================================================

export type TemplateCategory =
  | "transactional"
  | "conversational"
  | "marketing"
  | "newsletter";

export type Template = {
  id: string;
  accountLinkId: string;
  name: string;
  subject: string;
  previewText?: string | null;
  bodyMarkdown: string;
  layoutId?: string | null;
  templateVariables?: Record<string, string>;
  category?: TemplateCategory;
  isPreset?: boolean;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Newsletters (audience batch send)
// ============================================================================

export type NewsletterListStatus = "active" | "archived";
export type NewsletterStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type NewsletterStats = {
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
  complained: number;
  opened: number;
  totalOpens: number;
  clicked: number;
  totalClicks: number;
  unsubscribed: number;
};

export type Newsletter = {
  id: string;
  accountLinkId: string;
  name: string;
  slug: string;
  description?: string | null;
  audienceGroupId: string;
  domain: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  templateId: string;
  complianceIdentityId?: string | null;
  listStatus: NewsletterListStatus;
  status: NewsletterStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  targetFilter?: Record<string, unknown>;
  stats: NewsletterStats;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Recipients
// ============================================================================

export type RecipientStatus =
  | "queued"
  | "sending"
  | "delivered"
  | "bounced"
  | "skipped"
  | "failed";

export type Recipient = {
  id: string;
  newsletterId: string;
  audienceMemberId: string;
  email: string;
  name?: string | null;
  status: RecipientStatus;
  errorMessage?: string | null;
  bounceReason?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  unsubscribedAt?: string | null;
  openCount: number;
  clickCount: number;
  createdAt: string;
};

// ============================================================================
// Suppressions
// ============================================================================

export type AccountSuppressionReason =
  | "complaint"
  | "hard_bounce"
  | "manual_suppression"
  | "unsubscribe";

export type AccountSuppression = {
  id: string;
  accountLinkId: string;
  email: string;
  reason: AccountSuppressionReason;
  audienceGroupId: string | null;
  sourceNewsletterId?: string | null;
  createdAt: string;
};

// ============================================================================
// Shared
// ============================================================================

export type PipelineCard = {
  id: string;
  memberEmail: string;
  memberName: string | null;
  stage: string;
  note: string | null;
  updatedAt: string;
};

export type Activity = {
  id: string;
  memberEmail: string;
  type: string;
  payload: unknown;
  occurredAt: string;
};

export type ScheduledJob = {
  id: string;
  accountLinkId: string;
  kind: "newsletter" | "sync" | string;
  refId: string;
  runAt: string;
  status: "pending" | "done" | "failed" | string;
  createdAt: string;
};

export type TrackingEventType =
  | "delivered"
  | "open"
  | "click"
  | "bounce"
  | "unsubscribe"
  | "complaint";

export type TrackingEvent = {
  id: string;
  newsletterId: string;
  recipientId: string;
  memberEmail: string;
  type: TrackingEventType;
  url?: string | null;
  reason?: string | null;
  occurredAt: string;
};

export type NewsletterAsset = {
  id: string;
  key: string;
  newsletterId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

// ============================================================================
// Triggers (event-driven 1:1 send)
// ============================================================================

export type TriggerListStatus = "active" | "archived";
export type TriggerStatus = "draft" | "active" | "paused";
export type TriggerPurpose = "transactional" | "conversational" | "marketing";

export type InternalTriggerEvent = "account.verify_email" | "account.created";

export type TriggerSource =
  | {
      type: "http_webhook";
      secret: string;
      emailPath: string;
      namePath?: string | null;
      requiredFields?: string[];
    }
  | {
      type: "mailbox_inbound";
      domain: string;
      localPart: string;
      replyToSender: boolean;
      match?: {
        subjectContains?: string | null;
        fromDomain?: string | null;
      } | null;
    }
  | {
      type: "internal_event";
      event: InternalTriggerEvent;
    }
  | {
      type: "form_submit";
      formKey: string;
      emailPath: string;
      namePath?: string | null;
      requiredFields?: string[];
    };

export type TriggerSendStats = {
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
  complained: number;
  opened: number;
  totalOpens: number;
  clicked: number;
  totalClicks: number;
  unsubscribed: number;
};

export type TriggerStats = TriggerSendStats & {
  triggered: number;
  matched: number;
  deduped: number;
};

export type Trigger = {
  id: string;
  accountLinkId: string;
  name: string;
  slug: string;
  description?: string | null;
  domain: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  complianceIdentityId?: string | null;
  purpose: TriggerPurpose;
  listStatus: TriggerListStatus;
  status: TriggerStatus;
  source: TriggerSource;
  audienceGroupId?: string | null;
  cooldownSeconds: number;
  applyMarketingSuppression: boolean;
  templateId: string;
  stats: TriggerStats;
  lastTriggeredAt?: string | null;
  lastSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TriggerEventStatus =
  | "received"
  | "matched"
  | "queued"
  | "sent"
  | "skipped"
  | "failed";

export type TriggerEventSkipReason =
  | "no_match"
  | "paused"
  | "draft"
  | "cooldown"
  | "suppressed"
  | "invalid_payload"
  | "duplicate"
  | "send_failed";

export type TriggerEvent = {
  id: string;
  accountLinkId: string;
  triggerId: string | null;
  triggerType: TriggerSource["type"];
  idempotencyKey: string;
  recipientEmail: string;
  recipientName?: string | null;
  payload: Record<string, unknown>;
  status: TriggerEventStatus;
  skipReason?: TriggerEventSkipReason | null;
  occurredAt: string;
};

export type TriggerSendStatus =
  | "queued"
  | "sending"
  | "delivered"
  | "bounced"
  | "skipped"
  | "failed";

export type TriggerSend = {
  id: string;
  triggerId: string;
  triggerEventId: string;
  audienceMemberId?: string | null;
  email: string;
  name?: string | null;
  status: TriggerSendStatus;
  errorMessage?: string | null;
  bounceReason?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  unsubscribedAt?: string | null;
  openCount: number;
  clickCount: number;
  createdAt: string;
};

export type TriggerTrackingEventType =
  | "delivered"
  | "open"
  | "click"
  | "bounce"
  | "unsubscribe"
  | "complaint";

export type TriggerTrackingEvent = {
  id: string;
  triggerId: string;
  triggerSendId: string;
  memberEmail: string;
  type: TriggerTrackingEventType;
  url?: string | null;
  reason?: string | null;
  occurredAt: string;
};

export type TriggerAsset = {
  id: string;
  key: string;
  triggerId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

export type MessageTemplateAsset = {
  id: string;
  key: string;
  templateId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

// ============================================================================
// Audience
// ============================================================================

export type AudienceDataSource = {
  type: "generic_json";
  endpointUrl: string;
  credential?: string;
  credentialHeader?: string;
};

export type AudienceSyncRun = {
  id: string;
  trigger: "manual" | "cron";
  status: "running" | "success" | "error";
  phase: "idle" | "fetching" | "parsing" | "writing" | "done";
  startedAt: string;
  finishedAt?: string;
  totalCount?: number;
  processedCount?: number;
  skippedCount?: number;
  successCount?: number;
  failedCount?: number;
  error?: string;
};

export type AudienceSendStatus = "active" | "unsubscribed" | "bounced";

export type AudienceMember = {
  id: string;
  email: string;
  name: string | null;
  source: "manual" | "synced";
  addedAt: string;
  sendStatus: AudienceSendStatus;
  unsubscribedAt: string | null;
  bouncedAt?: string | null;
  bounceReason?: string | null;
  unsubscribeToken: string;
  consentSource: "manual" | "synced" | null;
  consentedAt: string | null;
};

export type AudienceGroup = {
  id: string;
  accountLinkId: string;
  name: string;
  domain: string;
  createdAt: string;
  defaultFrom: string | null;
  dataSource: AudienceDataSource | null;
  cronEnabled: boolean;
  cronIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "error" | null;
  lastSyncError: string | null;
  lastSyncCount: number | null;
  syncHistory: AudienceSyncRun[];
  contacts: AudienceMember[];
};

export type StudioDataStore = {
  account: AccountLink;
  complianceIdentities: ComplianceIdentity[];
  layouts: Layout[];
  templates: Template[];
  newsletters: Newsletter[];
  recipients: Recipient[];
  triggers: Trigger[];
  triggerEvents: TriggerEvent[];
  triggerSends: TriggerSend[];
  triggerTrackingEvents: TriggerTrackingEvent[];
  accountSuppressions: AccountSuppression[];
  pipelineCards: PipelineCard[];
  activities: Activity[];
  scheduledJobs: ScheduledJob[];
  trackingEvents: TrackingEvent[];
  newsletterAssets: NewsletterAsset[];
  triggerAssets: TriggerAsset[];
  templateAssets: MessageTemplateAsset[];
  audienceGroups: AudienceGroup[];
};
