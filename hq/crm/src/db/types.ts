/** Dev JSON persistence — production target is D1 (crm-mode-v0.2.md §3). */

export type AccountLink = {
  id: string;
  workerUrl: string | null;
  domain: string | null;
  createdAt: string;
};

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

export type Campaign = {
  id: string;
  accountLinkId: string;
  subject: string;
  bodyMarkdown: string;
  templateId: string | null;
  segmentJson: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  statsJson: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledJob = {
  id: string;
  accountLinkId: string;
  kind: string;
  refId: string;
  runAt: string;
  status: string;
  createdAt: string;
};

export type TrackingEvent = {
  id: string;
  campaignId: string;
  memberEmail: string;
  type: string;
  url: string | null;
  occurredAt: string;
};

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

export type CampaignAsset = {
  id: string;
  key: string;
  campaignId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
};

export type CrmDataStore = {
  account: AccountLink;
  audienceGroups: AudienceGroup[];
  pipelineCards: PipelineCard[];
  activities: Activity[];
  templates: Template[];
  campaigns: Campaign[];
  scheduledJobs: ScheduledJob[];
  trackingEvents: TrackingEvent[];
  campaignAssets: CampaignAsset[];
};
