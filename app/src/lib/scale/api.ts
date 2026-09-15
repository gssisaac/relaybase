/**
 * hq/scale client — Broadcast (audience + send) model.
 */
import { getScaleApiBase } from "./api-base";
import { SCALE_API_REQUEST_HEADER } from "./scale-origin";

export { getScaleApiBase, SCALE_PUBLIC_LINK_ORIGIN } from "./api-base";

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

export type ScaleTemplate = {
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

export type ScaleOverview = {
  generatedAt: string;
  summary: {
    totalContacts: number;
    activeAutomations: number;
    scheduledSends: number;
    sendingNow: number;
    monthlySentVolume: number;
    avgOpenRate: number;
    avgClickRate: number;
    deliverableRate: number;
  };
  schedule: {
    nextUpcoming: {
      id: string;
      name: string;
      subject: string;
      scheduledAt: string;
      audienceGroupName: string | null;
      recipientCount: number;
      status: BroadcastStatus;
    } | null;
    upcomingCount: number;
    upcomingList: Array<{
      id: string;
      name: string;
      subject: string;
      scheduledAt: string;
      status: "scheduled" | "sending";
      audienceGroupName: string | null;
    }>;
  };
  automations: {
    totalCount: number;
    activeCount: number;
    pausedCount: number;
    draftCount: number;
    triggers24h: number;
    recentEvents: Array<{
      id: string;
      automationId: string | null;
      automationName: string;
      triggerType: string;
      recipientEmail: string;
      status: string;
      occurredAt: string;
    }>;
  };
  broadcasts: {
    draftCount: number;
    inProgressCount: number;
    recentSent: Array<{
      id: string;
      name: string;
      sentAt: string;
      recipientCount: number;
      delivered: number;
      openRate: number;
      clickRate: number;
    }>;
    cloudflareQuota: {
      usedToday: number;
      /** Unknown until Cloudflare exposes per-account caps in API — do not assume a fixed ceiling. */
      dailyLimit: number | null;
      percentUsed: number | null;
    };
  };
  audience: {
    groupCount: number;
    health: { active: number; unsubscribed: number; bounced: number };
    recentSyncStatus: { lastSyncAt: string | null; failedGroupsCount: number };
    groups: Array<{
      id: string;
      name: string;
      domain: string;
      contactCount: number;
      lastSyncStatus?: "success" | "error";
      lastSyncAt?: string;
    }>;
  };
  charts: {
    sendsByWeek: Array<{
      weekStart: string;
      label: string;
      sent: number;
      opened: number;
      clicked: number;
    }>;
    audienceHealth: Array<{ key: string; label: string; count: number }>;
    automationTriggersByDay: Array<{ day: string; label: string; count: number }>;
    engagementRates: Array<{ key: string; label: string; value: number }>;
  };
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

class ScaleApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;
  constructor(status: number, message: string, body: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function scaleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getScaleApiBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      [SCALE_API_REQUEST_HEADER]: "1",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback =
      body?.error ??
      (body === null && res.headers.get("content-type")?.includes("text/html")
        ? "Scale API returned HTML — is hq/scale running (pnpm dev in hq/scale)?"
        : `request failed (${res.status})`);
    throw new ScaleApiError(res.status, fallback, body);
  }
  if (body === null) {
    throw new ScaleApiError(
      res.status,
      "Scale API returned a non-JSON response — is hq/scale running on port 32831?",
      null,
    );
  }
  return body as T;
}

export { ScaleApiError };

export type ScaleAccountCompliance = {
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  updatedAt: string;
};

export type ScaleComplianceIdentity = {
  id: string;
  name: string;
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScaleAccountLink = {
  id: string;
  workerUrl: string | null;
  domain: string | null;
  sendApiKeyConfigured?: boolean;
  compliance?: ScaleAccountCompliance;
  defaultComplianceIdentityId: string | null;
  createdAt: string;
};

export const scaleApi = {
  getAccountLink: () => scaleFetch<ScaleAccountLink>("/scale/account-link"),
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
    scaleFetch<ScaleAccountLink>("/scale/account-link", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  listComplianceIdentities: () =>
    scaleFetch<{
      identities: ScaleComplianceIdentity[];
      defaultComplianceIdentityId: string | null;
    }>("/scale/compliance-identities"),
  createComplianceIdentity: (input: {
    name?: string;
    organizationName?: string | null;
    postalAddress?: string | null;
    contactEmail?: string | null;
    setAsDefault?: boolean;
  }) =>
    scaleFetch<{ identity: ScaleComplianceIdentity }>("/scale/compliance-identities", {
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
    scaleFetch<{ identity: ScaleComplianceIdentity }>(`/scale/compliance-identities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  listTemplates: () => scaleFetch<{ templates: ScaleTemplate[] }>("/scale/templates"),
  importTemplate: (input: { name: string; htmlSource: string; variablesYaml?: string }) =>
    scaleFetch<{ template: ScaleTemplate; warnings: string[] }>("/scale/templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveTemplateSource: (id: string, input: { htmlSource: string; name?: string }) =>
    scaleFetch<{ template: ScaleTemplate; forked: boolean; warnings: string[] }>(
      `/scale/templates/${id}/source`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  getOverview: () => scaleFetch<ScaleOverview>("/scale/overview"),
  listBroadcasts: () => scaleFetch<{ broadcasts: Broadcast[] }>("/scale/broadcasts"),
  getSentOverview: () => scaleFetch<AccountSentOverview>("/scale/broadcasts/sent-stats"),
  getInProgressOverview: () => scaleFetch<InProgressOverview>("/scale/broadcasts/in-progress"),
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
  }) => scaleFetch<Broadcast>("/scale/broadcasts", { method: "POST", body: JSON.stringify(input) }),
  getBroadcast: (id: string) => scaleFetch<Broadcast>(`/scale/broadcasts/${id}`),
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
  ) => scaleFetch<Broadcast>(`/scale/broadcasts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveBroadcast: (id: string) =>
    scaleFetch<Broadcast>(`/scale/broadcasts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "archived" }),
    }),
  unarchiveBroadcast: (id: string) =>
    scaleFetch<Broadcast>(`/scale/broadcasts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "active" }),
    }),

  listBroadcastAudience: (broadcastId: string, params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return scaleFetch<{ members: BroadcastMember[] }>(
      `/scale/broadcasts/${broadcastId}/audience${suffix}`,
    );
  },
  syncBroadcastAudience: (broadcastId: string) =>
    scaleFetch<{
      added: number;
      updated: number;
      skipped: number;
      contactCount: number;
      activeCount: number;
    }>(`/scale/broadcasts/${broadcastId}/audience/sync`, { method: "POST" }),
  testSendBroadcast: (broadcastId: string, to: string) =>
    scaleFetch<{ ok: true }>(`/scale/broadcasts/${broadcastId}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  sendBroadcast: (broadcastId: string) =>
    scaleFetch<{
      broadcast: Broadcast;
      sent: number;
      failed: number;
      skipped: number;
      async?: boolean;
      queued?: number;
    }>(
      `/scale/broadcasts/${broadcastId}/send`,
      { method: "POST" },
    ),
  scheduleBroadcast: (broadcastId: string, runAt: string) =>
    scaleFetch<Broadcast>(`/scale/broadcasts/${broadcastId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt }),
    }),
  cancelSchedule: (broadcastId: string) =>
    scaleFetch<Broadcast>(`/scale/broadcasts/${broadcastId}/cancel-schedule`, {
      method: "POST",
    }),
  duplicateBroadcast: (broadcastId: string) =>
    scaleFetch<Broadcast>(`/scale/broadcasts/${broadcastId}/duplicate`, {
      method: "POST",
    }),
  getBroadcastStats: (broadcastId: string) =>
    scaleFetch<{
      broadcast: Broadcast;
      dispatch: BroadcastDispatchProgress | null;
      recipients: BroadcastRecipient[];
      trackingEvents: BroadcastTrackingEvent[];
      linkClicks: BroadcastLinkClickStat[];
    }>(`/scale/broadcasts/${broadcastId}/stats`),

  uploadBroadcastAsset: (
    broadcastId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    scaleFetch<{ url: string; key: string }>(`/scale/broadcasts/${broadcastId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listAutomations: () => scaleFetch<{ automations: Automation[] }>("/scale/automations"),
  createAutomation: (input: {
    name: string;
    domain?: string;
    purpose?: AutomationPurpose;
    triggerType?: AutomationTrigger["type"];
  }) =>
    scaleFetch<Automation>("/scale/automations", { method: "POST", body: JSON.stringify(input) }),
  getAutomation: (id: string) => scaleFetch<Automation>(`/scale/automations/${id}`),
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
    scaleFetch<Automation>(`/scale/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  activateAutomation: (id: string) =>
    scaleFetch<Automation>(`/scale/automations/${id}/activate`, { method: "POST" }),
  pauseAutomation: (id: string) =>
    scaleFetch<Automation>(`/scale/automations/${id}/pause`, { method: "POST" }),
  rotateAutomationWebhookSecret: (id: string) =>
    scaleFetch<{ automation: Automation; secret: string }>(
      `/scale/automations/${id}/rotate-webhook-secret`,
      { method: "POST" },
    ),
  testSendAutomation: (
    id: string,
    input: { email: string; name?: string; payload?: Record<string, unknown> },
  ) =>
    scaleFetch<{ ok: true; automationSendId: string; triggerEventId: string }>(
      `/scale/automations/${id}/test-send`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  getAutomationActivity: (id: string) =>
    scaleFetch<{ triggerEvents: AutomationTriggerEvent[]; sends: AutomationSend[] }>(
      `/scale/automations/${id}/activity`,
    ),
  getAutomationStats: (id: string) =>
    scaleFetch<{
      automationId: string;
      stats: AutomationStats;
      lastTriggeredAt: string | null;
      lastSentAt: string | null;
    }>(`/scale/automations/${id}/stats`),
  uploadAutomationAsset: (
    automationId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    scaleFetch<{ url: string; key: string }>(`/scale/automations/${automationId}/assets`, {
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
