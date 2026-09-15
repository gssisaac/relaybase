/**
 * hq/crm client — Broadcast (audience + send) model.
 */
import { getCrmApiBase } from "./api-base";
import { CRM_API_REQUEST_HEADER } from "./crm-origin";

export { getCrmApiBase, CRM_PUBLIC_LINK_ORIGIN } from "./api-base";

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

export type CrmTemplate = {
  id: string;
  name: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null;
  isBuiltin: boolean;
  derivedFromTemplateId: string | null;
  createdAt: string;
};

export type BroadcastListStatus = "active" | "archived";
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type BroadcastStats = {
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

export type Broadcast = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  audienceGroupId: string | null;
  audienceGroupName: string | null;
  audienceGroupDomain: string | null;
  /** Sending domain (Console); must match linked audience group when set. */
  domain: string | null;
  audienceContactCount: number | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  defaultTemplateId: string | null;
  /** null = account default compliance sender. */
  complianceIdentityId: string | null;
  listStatus: BroadcastListStatus;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  templateId: string | null;
  templateVariables: Record<string, string>;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  stats: BroadcastStats;
  audienceActiveCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastMemberStatus = "active" | "unsubscribed" | "bounced";
export type BroadcastMemberSource = "manual" | "synced";

/** Live audience contact as seen from a broadcast (group is source of truth). */
export type BroadcastMember = {
  id: string;
  broadcastId: string;
  audienceMemberId: string;
  email: string;
  name: string | null;
  status: BroadcastMemberStatus;
  source: BroadcastMemberSource;
  unsubscribedAt: string | null;
  bouncedAt: string | null;
  bounceReason: string | null;
  addedAt: string;
  unsubscribeToken?: string;
};

export type RecipientStatus =
  | "queued"
  | "sending"
  | "delivered"
  | "bounced"
  | "skipped"
  | "failed";

export type BroadcastTrackingEventType =
  | "delivered"
  | "open"
  | "click"
  | "bounce"
  | "unsubscribe"
  | "complaint";

export type BroadcastTrackingEvent = {
  id: string;
  recipientId: string;
  memberEmail: string;
  type: BroadcastTrackingEventType;
  url: string | null;
  reason: string | null;
  occurredAt: string;
};

export type BroadcastLinkClickStat = {
  url: string;
  clicks: number;
  uniqueClicks: number;
};

export type AccountSentOverview = {
  period: { from: string; to: string };
  totals: BroadcastStats & { broadcasts: number };
  rates: { delivery: number; open: number; click: number; bounce: number };
  byWeek: { weekStart: string; sent: number; opened: number; clicked: number }[];
  byAudience: {
    audienceGroupId: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
  }[];
  broadcasts: Array<{
    id: string;
    name: string;
    subject: string;
    status: BroadcastStatus;
    sentAt: string | null;
    finishedAt: string | null;
    stats: BroadcastStats;
    audienceGroupName: string | null;
  }>;
  topLinks: { url: string; clicks: number; uniqueClicks: number; broadcastId: string }[];
};

export type BroadcastDispatchProgress = {
  batchSize: number;
  batchIntervalSeconds: number;
  queue: {
    total: number;
    queued: number;
    inFlight: number;
    processed: number;
    skipped: number;
  };
  startedAt: string | null;
  lastBatchAt: string | null;
  nextBatchAt: string | null;
  estimatedCompletionAt: string | null;
  recipientsPerMinute: number | null;
};

export type InProgressOverview = {
  sending: Array<{
    broadcast: Broadcast;
    queue: {
      total: number;
      queued: number;
      sending: number;
      processed: number;
      skipped: number;
    };
    startedAt: string | null;
    lastDispatchedAt: string | null;
    dispatch: BroadcastDispatchProgress | null;
    recentEvents: BroadcastTrackingEvent[];
  }>;
  scheduled: Broadcast[];
};

export type BroadcastRecipient = {
  id: string;
  audienceMemberId: string;
  email: string;
  name: string | null;
  status: RecipientStatus;
  errorMessage: string | null;
  bounceReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
  openCount: number;
  clickCount: number;
};

class CrmApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;
  constructor(status: number, message: string, body: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function crmFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getCrmApiBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      [CRM_API_REQUEST_HEADER]: "1",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback =
      body?.error ??
      (body === null && res.headers.get("content-type")?.includes("text/html")
        ? "CRM API returned HTML — is hq/crm running (pnpm dev in hq/crm)?"
        : `request failed (${res.status})`);
    throw new CrmApiError(res.status, fallback, body);
  }
  if (body === null) {
    throw new CrmApiError(
      res.status,
      "CRM API returned a non-JSON response — is hq/crm running on port 32831?",
      null,
    );
  }
  return body as T;
}

export { CrmApiError };

export type CrmAccountCompliance = {
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  updatedAt: string;
};

export type CrmComplianceIdentity = {
  id: string;
  name: string;
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmAccountLink = {
  id: string;
  workerUrl: string | null;
  domain: string | null;
  sendApiKeyConfigured?: boolean;
  compliance?: CrmAccountCompliance;
  defaultComplianceIdentityId: string | null;
  createdAt: string;
};

export const crmApi = {
  getAccountLink: () => crmFetch<CrmAccountLink>("/crm/account-link"),
  updateAccountLink: (input: {
    domain?: string | null;
    workerUrl?: string | null;
    sendApiKey?: string | null;
    defaultComplianceIdentityId?: string | null;
    compliance?: Partial<{
      organizationName: string | null;
      postalAddress: string | null;
      contactEmail: string | null;
    }>;
  }) =>
    crmFetch<CrmAccountLink>("/crm/account-link", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  listComplianceIdentities: () =>
    crmFetch<{
      identities: CrmComplianceIdentity[];
      defaultComplianceIdentityId: string | null;
    }>("/crm/compliance-identities"),
  createComplianceIdentity: (input: {
    name?: string;
    organizationName?: string | null;
    postalAddress?: string | null;
    contactEmail?: string | null;
    setAsDefault?: boolean;
  }) =>
    crmFetch<{ identity: CrmComplianceIdentity }>("/crm/compliance-identities", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateComplianceIdentity: (
    id: string,
    input: Partial<{
      name: string;
      organizationName: string | null;
      postalAddress: string | null;
      contactEmail: string | null;
    }>,
  ) =>
    crmFetch<{ identity: CrmComplianceIdentity }>(`/crm/compliance-identities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  listTemplates: () => crmFetch<{ templates: CrmTemplate[] }>("/crm/templates"),
  importTemplate: (input: { name: string; htmlSource: string; variablesYaml?: string }) =>
    crmFetch<{ template: CrmTemplate; warnings: string[] }>("/crm/templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveTemplateSource: (id: string, input: { htmlSource: string; name?: string }) =>
    crmFetch<{ template: CrmTemplate; forked: boolean; warnings: string[] }>(
      `/crm/templates/${id}/source`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  listBroadcasts: () => crmFetch<{ broadcasts: Broadcast[] }>("/crm/broadcasts"),
  getSentOverview: () => crmFetch<AccountSentOverview>("/crm/broadcasts/sent-stats"),
  getInProgressOverview: () => crmFetch<InProgressOverview>("/crm/broadcasts/in-progress"),
  createBroadcast: (input: {
    name: string;
    domain: string;
    audienceGroupId: string;
    workerUrl?: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultTemplateId?: string;
  }) => crmFetch<Broadcast>("/crm/broadcasts", { method: "POST", body: JSON.stringify(input) }),
  getBroadcast: (id: string) => crmFetch<Broadcast>(`/crm/broadcasts/${id}`),
  updateBroadcast: (
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      domain: string;
      workerUrl?: string;
      fromName: string | null;
      fromEmail: string | null;
      replyTo: string | null;
      defaultTemplateId: string | null;
      complianceIdentityId: string | null;
      listStatus: BroadcastListStatus;
      subject: string;
      previewText: string;
      bodyMarkdown: string;
      templateId: string;
      templateVariables: Record<string, string>;
      audienceGroupId: string;
    }>,
  ) => crmFetch<Broadcast>(`/crm/broadcasts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveBroadcast: (id: string) =>
    crmFetch<Broadcast>(`/crm/broadcasts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "archived" }),
    }),
  unarchiveBroadcast: (id: string) =>
    crmFetch<Broadcast>(`/crm/broadcasts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "active" }),
    }),

  listBroadcastAudience: (broadcastId: string, params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return crmFetch<{ members: BroadcastMember[] }>(
      `/crm/broadcasts/${broadcastId}/audience${suffix}`,
    );
  },
  syncBroadcastAudience: (broadcastId: string) =>
    crmFetch<{
      added: number;
      updated: number;
      skipped: number;
      contactCount: number;
      activeCount: number;
    }>(`/crm/broadcasts/${broadcastId}/audience/sync`, { method: "POST" }),
  testSendBroadcast: (broadcastId: string, to: string) =>
    crmFetch<{ ok: true }>(`/crm/broadcasts/${broadcastId}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  sendBroadcast: (broadcastId: string) =>
    crmFetch<{
      broadcast: Broadcast;
      sent: number;
      failed: number;
      skipped: number;
      async?: boolean;
      queued?: number;
    }>(
      `/crm/broadcasts/${broadcastId}/send`,
      { method: "POST" },
    ),
  scheduleBroadcast: (broadcastId: string, runAt: string) =>
    crmFetch<Broadcast>(`/crm/broadcasts/${broadcastId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt }),
    }),
  cancelSchedule: (broadcastId: string) =>
    crmFetch<Broadcast>(`/crm/broadcasts/${broadcastId}/cancel-schedule`, {
      method: "POST",
    }),
  duplicateBroadcast: (broadcastId: string) =>
    crmFetch<Broadcast>(`/crm/broadcasts/${broadcastId}/duplicate`, {
      method: "POST",
    }),
  getBroadcastStats: (broadcastId: string) =>
    crmFetch<{
      broadcast: Broadcast;
      dispatch: BroadcastDispatchProgress | null;
      recipients: BroadcastRecipient[];
      trackingEvents: BroadcastTrackingEvent[];
      linkClicks: BroadcastLinkClickStat[];
    }>(`/crm/broadcasts/${broadcastId}/stats`),

  uploadBroadcastAsset: (
    broadcastId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    crmFetch<{ url: string; key: string }>(`/crm/broadcasts/${broadcastId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listAutomations: () => crmFetch<{ automations: Automation[] }>("/crm/automations"),
  createAutomation: (input: {
    name: string;
    domain?: string;
    purpose?: AutomationPurpose;
    triggerType?: AutomationTrigger["type"];
  }) =>
    crmFetch<Automation>("/crm/automations", { method: "POST", body: JSON.stringify(input) }),
  getAutomation: (id: string) => crmFetch<Automation>(`/crm/automations/${id}`),
  updateAutomation: (
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      domain: string;
      fromName: string | null;
      fromEmail: string | null;
      replyTo: string | null;
      complianceIdentityId: string | null;
      listStatus: AutomationListStatus;
      purpose: AutomationPurpose;
      trigger: AutomationTrigger;
      audienceGroupId: string | null;
      cooldownSeconds: number;
      applyMarketingSuppression: boolean;
      subject: string;
      previewText: string | null;
      bodyMarkdown: string;
      templateId: string | null;
      templateVariables: Record<string, string>;
    }>,
  ) =>
    crmFetch<Automation>(`/crm/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  activateAutomation: (id: string) =>
    crmFetch<Automation>(`/crm/automations/${id}/activate`, { method: "POST" }),
  pauseAutomation: (id: string) =>
    crmFetch<Automation>(`/crm/automations/${id}/pause`, { method: "POST" }),
  rotateAutomationWebhookSecret: (id: string) =>
    crmFetch<{ automation: Automation; secret: string }>(
      `/crm/automations/${id}/rotate-webhook-secret`,
      { method: "POST" },
    ),
  testSendAutomation: (
    id: string,
    input: { email: string; name?: string; payload?: Record<string, unknown> },
  ) =>
    crmFetch<{ ok: true; automationSendId: string; triggerEventId: string }>(
      `/crm/automations/${id}/test-send`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  getAutomationActivity: (id: string) =>
    crmFetch<{ triggerEvents: AutomationTriggerEvent[]; sends: AutomationSend[] }>(
      `/crm/automations/${id}/activity`,
    ),
  getAutomationStats: (id: string) =>
    crmFetch<{
      automationId: string;
      stats: AutomationStats;
      lastTriggeredAt: string | null;
      lastSentAt: string | null;
    }>(`/crm/automations/${id}/stats`),
  uploadAutomationAsset: (
    automationId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    crmFetch<{ url: string; key: string }>(`/crm/automations/${automationId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export type AutomationListStatus = "active" | "archived";
export type AutomationStatus = "draft" | "active" | "paused";
export type AutomationPurpose = "transactional" | "conversational" | "marketing";

export type InternalAutomationEvent = "account.verify_email" | "account.created";

export type AutomationTrigger =
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
      event: InternalAutomationEvent;
    }
  | {
      type: "form_submit";
      formKey: string;
      emailPath: string;
      namePath?: string | null;
      requiredFields?: string[];
    };

export type AutomationStats = BroadcastStats & {
  triggered: number;
  matched: number;
  deduped: number;
};

export type Automation = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  domain: string;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  complianceIdentityId: string | null;
  purpose: AutomationPurpose;
  listStatus: AutomationListStatus;
  status: AutomationStatus;
  trigger: AutomationTrigger;
  audienceGroupId: string | null;
  audienceGroupName: string | null;
  cooldownSeconds: number;
  applyMarketingSuppression: boolean;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  templateId: string | null;
  templateVariables: Record<string, string>;
  stats: AutomationStats;
  lastTriggeredAt: string | null;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationTriggerEventStatus =
  | "received"
  | "matched"
  | "queued"
  | "sent"
  | "skipped"
  | "failed";

export type AutomationTriggerEvent = {
  id: string;
  automationId: string | null;
  triggerType: AutomationTrigger["type"];
  idempotencyKey: string;
  recipientEmail: string;
  recipientName: string | null;
  payload: Record<string, unknown>;
  status: AutomationTriggerEventStatus;
  skipReason: string | null;
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
  audienceMemberId: string | null;
  email: string;
  name: string | null;
  status: AutomationSendStatus;
  errorMessage: string | null;
  bounceReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
  openCount: number;
  clickCount: number;
  createdAt: string;
};
