/**
 * CRM Development JSON File Store Types (`data/store.json`).
 *
 * During active development, all state is stored in a structured JSON file.
 * Production D1 database schemas will be synthesized after the TypeScript
 * models and workflows stabilize (docs/features/crm-campaign-broadcast-subscriber-model.md §2).
 */

// ============================================================================
// Core Tenant & Settings
// ============================================================================

export type AccountLink = {
  id: string;
  workerUrl: string | null;
  domain: string | null;
  createdAt: string;
};

// ============================================================================
// 1. Broadcasts (Audience scope + email send)
// ============================================================================

export type BroadcastListStatus = "active" | "archived";

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type BroadcastStats = {
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
};

export type Broadcast = {
  id: string;
  accountLinkId: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Linked audience group — broadcast audience rows overlay group contacts. */
  audienceGroupId: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  defaultTemplateId?: string | null;
  listStatus: BroadcastListStatus;
  subject: string;
  previewText?: string | null;
  bodyMarkdown: string;
  templateId?: string | null;
  status: BroadcastStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  targetFilter?: Record<string, unknown>;
  stats: BroadcastStats;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// 2. Broadcast audience (per-broadcast consent on audience contacts)
// ============================================================================

export type BroadcastMemberStatus = "active" | "unsubscribed" | "pending" | "bounced";
export type BroadcastMemberSource = "manual" | "sync" | "csv" | "webhook" | "audience_group";

export type BroadcastMember = {
  id: string;
  accountLinkId: string;
  broadcastId: string;
  audienceMemberId: string | null;
  email: string;
  name?: string | null;
  status: BroadcastMemberStatus;
  source: BroadcastMemberSource;
  unsubscribeToken: string;
  unsubscribedAt?: string | null;
  bouncedAt?: string | null;
  bounceReason?: string | null;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// 3. Recipients (Send-Time Immutable Queue & Engagement Ledger)
// ============================================================================

export type RecipientStatus = "queued" | "sending" | "sent" | "skipped" | "failed";

export type Recipient = {
  id: string;
  broadcastId: string;
  broadcastMemberId: string;
  email: string;
  name?: string | null;
  status: RecipientStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  openCount: number;
  clickCount: number;
  createdAt: string;
};

// ============================================================================
// 5. Account Suppression (Global Opt-Outs & Hard Bounces)
// ============================================================================

export type AccountSuppressionReason = "complaint" | "hard_bounce" | "manual_suppression";

export type AccountSuppression = {
  id: string;
  accountLinkId: string;
  email: string;
  reason: AccountSuppressionReason;
  createdAt: string;
};

// ============================================================================
// 6. Shared CRM & System Support Types
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

export type Template = {
  id: string;
  accountLinkId: string | null;
  name: string;
  htmlSource: string;
  isBuiltin: boolean;
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

export type TrackingEvent = {
  id: string;
  broadcastId: string;
  recipientId: string;
  memberEmail: string;
  type: "open" | "click";
  url?: string | null;
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

export type AudienceMember = {
  id: string;
  email: string;
  name: string | null;
  source: "manual" | "synced";
  addedAt: string;
  /** Send eligibility for linked broadcasts — unified with broadcast audience rows. */
  sendStatus: "active" | "unsubscribed";
  unsubscribedAt: string | null;
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

export type CrmDataStore = {
  account: AccountLink;
  broadcasts: Broadcast[];
  broadcastMembers: BroadcastMember[];
  recipients: Recipient[];
  accountSuppressions: AccountSuppression[];
  pipelineCards: PipelineCard[];
  activities: Activity[];
  templates: Template[];
  scheduledJobs: ScheduledJob[];
  trackingEvents: TrackingEvent[];
  broadcastAssets: BroadcastAsset[];
  audienceGroups: AudienceGroup[];
};
