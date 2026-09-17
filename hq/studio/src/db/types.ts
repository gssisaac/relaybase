/**
 * Studio dev store types (`data/store/*.json` + `data/templates/*.yaml` + `data/messages/*.yaml`).
 *
 * Layout — HTML frame · Template — read-only catalog blueprint · Message — editable copy ·
 * Trigger — event send · Newsletter — subscriber send.
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
// Templates (read-only catalog — `data/templates/<id>.yaml`)
// ============================================================================

export type TemplateCategory =
  | "transactional"
  | "conversational"
  | "marketing"
  | "newsletter";

/** Blueprint in the template gallery — not user-editable. */
export type Template = {
  id: string;
  name: string;
  description?: string | null;
  subject: string;
  previewText?: string | null;
  bodyMarkdown: string;
  layoutId: string;
  templateVariables?: Record<string, string>;
  category?: TemplateCategory;
  isBuiltin: true;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Messages (editable copies — `data/messages/<id>.yaml`)
// ============================================================================

export type Message = {
  id: string;
  accountLinkId: string;
  name: string;
  subject: string;
  previewText?: string | null;
  bodyMarkdown: string;
  layoutId?: string | null;
  templateVariables?: Record<string, string>;
  /** Catalog template this was forked from (`Use template`). */
  forkedFromTemplateId?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Newsletters (subscriber batch send)
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
  subscriberGroupId: string;
  domain: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  /** Editable message body/subject used for this send. */
  messageId: string;
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
  subscriberMemberId: string;
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
  subscriberGroupId: string | null;
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
  subscriberGroupId?: string | null;
  cooldownSeconds: number;
  applyMarketingSuppression: boolean;
  /** Editable message body/subject sent by this automation. */
  messageId: string;
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
  subscriberMemberId?: string | null;
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

export type MessageAsset = {
  id: string;
  key: string;
  messageId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

/** @deprecated Renamed to MessageAsset — migrated on store load. */

// ============================================================================
// Subscriber groups
// ============================================================================

export type SubscriberDataSource = {
  type: "generic_json";
  endpointUrl: string;
  credential?: string;
  credentialHeader?: string;
};

export type SubscriberSyncRun = {
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

export type SubscriberSendStatus = "active" | "unsubscribed" | "bounced";

export type SubscriberMember = {
  id: string;
  email: string;
  name: string | null;
  source: "manual" | "synced";
  addedAt: string;
  sendStatus: SubscriberSendStatus;
  unsubscribedAt: string | null;
  bouncedAt?: string | null;
  bounceReason?: string | null;
  unsubscribeToken: string;
  consentSource: "manual" | "synced" | null;
  consentedAt: string | null;
};

export type SubscriberGroup = {
  id: string;
  accountLinkId: string;
  name: string;
  domain: string;
  createdAt: string;
  defaultFrom: string | null;
  dataSource: SubscriberDataSource | null;
  cronEnabled: boolean;
  cronIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "error" | null;
  lastSyncError: string | null;
  lastSyncCount: number | null;
  syncHistory: SubscriberSyncRun[];
  contacts: SubscriberMember[];
};

export type StudioDataStore = {
  account: AccountLink;
  complianceIdentities: ComplianceIdentity[];
  layouts: Layout[];
  /** Hydrated catalog blueprints (not persisted under `data/store/`). */
  templates: Template[];
  /** Hydrated user messages (not persisted under `data/store/`). */
  messages: Message[];
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
  messageAssets: MessageAsset[];
  subscriberGroups: SubscriberGroup[];
};
