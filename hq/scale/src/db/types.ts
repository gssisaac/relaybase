/**
 * Scale Development JSON File Store Types (`data/store.json`).
 *
 * During active development, all state is stored in a structured JSON file.
 * Production D1 database schemas will be synthesized after the TypeScript
 * models and workflows stabilize (docs/features/crm-audience-broadcast-model.md).
 */

// ============================================================================
// Core Tenant & Settings
// ============================================================================

/** CAN-SPAM / marketing disclosure defaults merged into broadcast footers. */
export type AccountComplianceSettings = {
  organizationName: string | null;
  /** Physical postal address (required for US commercial email). */
  postalAddress: string | null;
  contactEmail: string | null;
  updatedAt: string;
};

/** Reusable sender disclosure block — shared across broadcasts and edited in one place. */
export type ComplianceIdentity = {
  id: string;
  accountLinkId: string;
  /** Short label in pickers (e.g. "Acme US", "EU entity"). */
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
  /**
   * Domain-scoped Worker API key for `POST /v1/send` (dev JSON store only).
   * Production: encrypted at rest; never returned from GET account-link.
   */
  sendApiKey?: string | null;
  /** @deprecated Mirror of default identity — use `complianceIdentities` + `defaultComplianceIdentityId`. */
  compliance: AccountComplianceSettings;
  /** Default footer identity for new broadcasts when `broadcast.complianceIdentityId` is unset. */
  defaultComplianceIdentityId: string | null;
  createdAt: string;
};

// ============================================================================
// 1. Broadcasts (Audience scope + email send)
// ============================================================================

export type BroadcastListStatus = "active" | "archived";

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type BroadcastStats = {
  /** Messages handed off to the mail pipeline (success + hard failures at SMTP). */
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  /** Recipients skipped at dispatch (inactive / suppressed). */
  skipped: number;
  /** Unique recipients who filed a spam complaint. */
  complained: number;
  /** Unique recipients who opened at least once. */
  opened: number;
  totalOpens: number;
  /** Unique recipients who clicked at least once. */
  clicked: number;
  totalClicks: number;
  unsubscribed: number;
};

export type Broadcast = {
  id: string;
  accountLinkId: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Linked audience group — send targets are resolved from group contacts at dispatch. */
  audienceGroupId: string;
  /** Console-managed sending domain (must match linked audience group). */
  domain: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  defaultTemplateId?: string | null;
  /** Footer / CAN-SPAM disclosure; falls back to account default when null. */
  complianceIdentityId?: string | null;
  listStatus: BroadcastListStatus;
  subject: string;
  previewText?: string | null;
  bodyMarkdown: string;
  templateId?: string | null;
  /** Values for `{{vars.*}}` placeholders defined on the selected template. */
  templateVariables?: Record<string, string>;
  status: BroadcastStatus;
  scheduledAt?: string | null;
  /** Dispatch start time (set when status becomes `sending`). */
  sentAt?: string | null;
  startedAt?: string | null;
  /** When status became `sent` or `failed`. */
  finishedAt?: string | null;
  targetFilter?: Record<string, unknown>;
  stats: BroadcastStats;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// 2. Recipients (Send-Time Immutable Queue & Engagement Ledger)
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
  broadcastId: string;
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
// 5. Account Suppression (Global Opt-Outs & Hard Bounces)
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
  /** null = account-wide; set = only this audience group. */
  audienceGroupId: string | null;
  sourceBroadcastId?: string | null;
  createdAt: string;
};

// ============================================================================
// 6. Shared Scale & System Support Types
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

export type TemplateVariableField = {
  key: string;
  type: "text" | "image";
  label: string;
  description?: string;
  required?: boolean;
  defaultFrom?: "compliance.organizationName";
};

export type TemplateVariablesSchema = {
  fields: TemplateVariableField[];
};

export type Template = {
  id: string;
  accountLinkId: string | null;
  name: string;
  htmlSource: string;
  variablesSchema?: TemplateVariablesSchema | null;
  isBuiltin: boolean;
  /** When set, layout thumbnail follows the forked built-in (e.g. header). */
  derivedFromTemplateId?: string | null;
  createdAt: string;
};

export type ScheduledJob = {
  id: string;
  accountLinkId: string;
  kind: "broadcast" | "sync" | string;
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
  broadcastId: string;
  recipientId: string;
  memberEmail: string;
  type: TrackingEventType;
  url?: string | null;
  reason?: string | null;
  occurredAt: string;
};

export type BroadcastAsset = {
  id: string;
  key: string;
  broadcastId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

// ============================================================================
// 3. Automations (Event-triggered 1:1 email — separate from broadcast sends)
// ============================================================================

export type AutomationListStatus = "active" | "archived";
export type AutomationStatus = "draft" | "active" | "paused";
export type AutomationPurpose = "transactional" | "conversational" | "marketing";

export type InternalAutomationEvent = "account.verify_email" | "account.created";

export type AutomationTrigger =
  | {
      type: "http_webhook";
      /** Bearer token for POST /scale/hooks/automation/:automationId */
      secret: string;
      emailPath: string;
      namePath?: string | null;
      requiredFields?: string[];
    }
  | {
      type: "mailbox_inbound";
      domain: string;
      /** Address local-part or `*` for catch-all on domain. */
      localPart: string;
      replyToSender: boolean;
      match?: {
        subjectContains?: string | null;
        fromDomain?: string | null;
      } | null;
    }
  | {
      type: "internal_event";
      event: InternalAutomationEvent;
    }
  | {
      type: "form_submit";
      /** Public key in POST /scale/hooks/form/:formKey */
      formKey: string;
      emailPath: string;
      namePath?: string | null;
      requiredFields?: string[];
    };

export type AutomationSendStats = {
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

export type AutomationStats = AutomationSendStats & {
  triggered: number;
  matched: number;
  deduped: number;
};

export type Automation = {
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
  purpose: AutomationPurpose;
  listStatus: AutomationListStatus;
  status: AutomationStatus;
  trigger: AutomationTrigger;
  /** Optional: upsert contact on send (conversational / marketing). */
  audienceGroupId?: string | null;
  cooldownSeconds: number;
  applyMarketingSuppression: boolean;
  subject: string;
  previewText?: string | null;
  bodyMarkdown: string;
  templateId?: string | null;
  templateVariables?: Record<string, string>;
  stats: AutomationStats;
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
  automationId: string | null;
  triggerType: AutomationTrigger["type"];
  idempotencyKey: string;
  recipientEmail: string;
  recipientName?: string | null;
  payload: Record<string, unknown>;
  status: TriggerEventStatus;
  skipReason?: TriggerEventSkipReason | null;
  occurredAt: string;
};

export type AutomationSendStatus =
  | "queued"
  | "sending"
  | "delivered"
  | "bounced"
  | "skipped"
  | "failed";

export type AutomationSend = {
  id: string;
  automationId: string;
  triggerEventId: string;
  audienceMemberId?: string | null;
  email: string;
  name?: string | null;
  status: AutomationSendStatus;
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

/** Engagement ledger for automation sends — not mixed with broadcast trackingEvents. */
export type AutomationTrackingEventType =
  | "delivered"
  | "open"
  | "click"
  | "bounce"
  | "unsubscribe"
  | "complaint";

export type AutomationTrackingEvent = {
  id: string;
  automationId: string;
  automationSendId: string;
  memberEmail: string;
  type: AutomationTrackingEventType;
  url?: string | null;
  reason?: string | null;
  occurredAt: string;
};

export type AutomationAsset = {
  id: string;
  key: string;
  automationId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

// ============================================================================
// Audience Groups (Account-wide contact pools)
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
  /** Per-contact token for list-scoped unsubscribe links. */
  unsubscribeToken: string;
  /** When/how the contact became mailable (audit; not legal proof alone). */
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

// ============================================================================
// Root Dev JSON Data Store (`data/store.json`)
// ============================================================================

export type ScaleDataStore = {
  account: AccountLink;
  complianceIdentities: ComplianceIdentity[];
  broadcasts: Broadcast[];
  recipients: Recipient[];
  automations: Automation[];
  triggerEvents: TriggerEvent[];
  automationSends: AutomationSend[];
  automationTrackingEvents: AutomationTrackingEvent[];
  accountSuppressions: AccountSuppression[];
  pipelineCards: PipelineCard[];
  activities: Activity[];
  templates: Template[];
  scheduledJobs: ScheduledJob[];
  trackingEvents: TrackingEvent[];
  broadcastAssets: BroadcastAsset[];
  automationAssets: AutomationAsset[];
  audienceGroups: AudienceGroup[];
};
