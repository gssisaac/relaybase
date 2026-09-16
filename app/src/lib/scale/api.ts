/**
 * hq/scale client — Newsletter (audience + send) and Trigger models.
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

/** HTML email shell (was “templates” in older API). */
export type ScaleLayout = {
  id: string;
  name: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null;
  isBuiltin: boolean;
  derivedFromLayoutId: string | null;
  createdAt: string;
};

export type MessageTemplateCategory =
  | "transactional"
  | "marketing"
  | "newsletter"
  | "conversational";

export type MessageTemplate = {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  templateVariables: Record<string, string>;
  category: MessageTemplateCategory | null;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
};

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
  name: string;
  slug: string;
  description: string | null;
  audienceGroupId: string | null;
  audienceGroupName: string | null;
  audienceGroupDomain: string | null;
  domain: string | null;
  audienceContactCount: number | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  defaultLayoutId: string | null;
  complianceIdentityId: string | null;
  listStatus: NewsletterListStatus;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  messageTemplateId: string | null;
  templateVariables: Record<string, string>;
  status: NewsletterStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  stats: NewsletterStats;
  audienceActiveCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterMemberStatus = "active" | "unsubscribed" | "bounced";
export type NewsletterMemberSource = "manual" | "synced";

export type NewsletterMember = {
  id: string;
  newsletterId: string;
  audienceMemberId: string;
  email: string;
  name: string | null;
  status: NewsletterMemberStatus;
  source: NewsletterMemberSource;
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

export type NewsletterTrackingEventType =
  | "delivered"
  | "open"
  | "click"
  | "bounce"
  | "unsubscribe"
  | "complaint";

export type NewsletterTrackingEvent = {
  id: string;
  recipientId: string;
  memberEmail: string;
  type: NewsletterTrackingEventType;
  url: string | null;
  reason: string | null;
  occurredAt: string;
};

export type NewsletterLinkClickStat = {
  url: string;
  clicks: number;
  uniqueClicks: number;
};

export type AccountSentOverview = {
  period: { from: string; to: string };
  totals: NewsletterStats & { newsletters: number };
  rates: { delivery: number; open: number; click: number; bounce: number };
  byWeek: { weekStart: string; sent: number; opened: number; clicked: number }[];
  byAudience: {
    audienceGroupId: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
  }[];
  newsletters: Array<{
    id: string;
    name: string;
    subject: string;
    status: NewsletterStatus;
    sentAt: string | null;
    finishedAt: string | null;
    stats: NewsletterStats;
    audienceGroupName: string | null;
  }>;
  topLinks: { url: string; clicks: number; uniqueClicks: number; newsletterId: string }[];
};

export type NewsletterDispatchProgress = {
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

export type TriggerStatsOverview = {
  generatedAt: string;
  period: { from: string; to: string };
  triggers24h: number;
  triggers7d: number;
  totals: TriggerStats & { triggers: number };
  rates: { delivery: number; open: number; click: number; bounce: number };
  byDay: { day: string; label: string; count: number }[];
  byTrigger: Array<{
    id: string;
    name: string;
    status: TriggerStatus;
    stats: TriggerStats;
    triggers24h: number;
  }>;
  recentEvents: Array<{
    id: string;
    triggerId: string | null;
    triggerName: string;
    sourceType: TriggerSource["type"];
    recipientEmail: string;
    status: TriggerEventStatus;
    occurredAt: string;
  }>;
};

export type ScaleOverview = {
  generatedAt: string;
  summary: {
    totalContacts: number;
    activeTriggers: number;
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
      status: NewsletterStatus;
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
  triggers: {
    totalCount: number;
    activeCount: number;
    pausedCount: number;
    draftCount: number;
    triggers24h: number;
    recentEvents: Array<{
      id: string;
      triggerId: string | null;
      triggerName: string;
      sourceType: string;
      recipientEmail: string;
      status: string;
      occurredAt: string;
    }>;
  };
  newsletters: {
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
    newsletter: Newsletter;
    queue: {
      total: number;
      queued: number;
      sending: number;
      processed: number;
      skipped: number;
    };
    startedAt: string | null;
    lastDispatchedAt: string | null;
    dispatch: NewsletterDispatchProgress | null;
    recentEvents: NewsletterTrackingEvent[];
  }>;
  scheduled: Newsletter[];
};

export type NewsletterRecipient = {
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

  listLayouts: () => scaleFetch<{ layouts: ScaleLayout[] }>("/scale/layouts"),
  getLayout: (id: string) => scaleFetch<{ layout: ScaleLayout }>(`/scale/layouts/${id}`),
  deleteLayout: (id: string) =>
    scaleFetch<{ ok: true }>(`/scale/layouts/${id}`, { method: "DELETE" }),
  importLayout: (input: { name: string; htmlSource: string; variablesYaml?: string }) =>
    scaleFetch<{ layout: ScaleLayout; warnings: string[] }>("/scale/layouts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveLayoutSource: (id: string, input: { htmlSource: string; name?: string }) =>
    scaleFetch<{ layout: ScaleLayout; forked: boolean; warnings: string[] }>(
      `/scale/layouts/${id}/source`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  listMessageTemplates: () =>
    scaleFetch<{ templates: MessageTemplate[] }>("/scale/templates"),
  getMessageTemplate: (id: string) =>
    scaleFetch<{ template: MessageTemplate }>(`/scale/templates/${id}`),
  createMessageTemplate: (input: {
    name: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    category?: MessageTemplateCategory;
  }) =>
    scaleFetch<{ template: MessageTemplate }>("/scale/templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMessageTemplate: (
    id: string,
    input: Partial<{
      name: string;
      subject: string;
      previewText: string | null;
      bodyMarkdown: string;
      layoutId: string | null;
      templateVariables: Record<string, string>;
    }>,
  ) =>
    scaleFetch<{ template: MessageTemplate }>(`/scale/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  uploadMessageTemplateAsset: (
    templateId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    scaleFetch<{ url: string; key: string }>(`/scale/templates/${templateId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  testSendMessageTemplate: (
    templateId: string,
    input: {
      to: string;
      fromEmail: string;
      fromName?: string | null;
      replyTo?: string | null;
      mergeTags?: Record<string, string>;
    },
  ) =>
    scaleFetch<{ ok: true }>(`/scale/templates/${templateId}/test-send`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteMessageTemplate: (id: string) =>
    scaleFetch<{ ok: true }>(`/scale/templates/${id}`, { method: "DELETE" }),

  getOverview: () => scaleFetch<ScaleOverview>("/scale/overview"),
  listNewsletters: () => scaleFetch<{ newsletters: Newsletter[] }>("/scale/newsletters"),
  getSentOverview: () => scaleFetch<AccountSentOverview>("/scale/newsletters/sent-stats"),
  getInProgressOverview: () => scaleFetch<InProgressOverview>("/scale/newsletters/in-progress"),
  createNewsletter: (input: {
    name: string;
    domain: string;
    audienceGroupId: string;
    workerUrl?: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultLayoutId?: string;
  }) => scaleFetch<Newsletter>("/scale/newsletters", { method: "POST", body: JSON.stringify(input) }),
  getNewsletter: (id: string) => scaleFetch<Newsletter>(`/scale/newsletters/${id}`),
  updateNewsletter: (
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
      defaultLayoutId: string | null;
      complianceIdentityId: string | null;
      listStatus: NewsletterListStatus;
      subject: string;
      previewText: string;
      bodyMarkdown: string;
      layoutId: string;
      messageTemplateId: string | null;
      templateVariables: Record<string, string>;
      audienceGroupId: string;
    }>,
  ) => scaleFetch<Newsletter>(`/scale/newsletters/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveNewsletter: (id: string) =>
    scaleFetch<Newsletter>(`/scale/newsletters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "archived" }),
    }),
  unarchiveNewsletter: (id: string) =>
    scaleFetch<Newsletter>(`/scale/newsletters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "active" }),
    }),

  listNewsletterAudience: (newsletterId: string, params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return scaleFetch<{ members: NewsletterMember[] }>(
      `/scale/newsletters/${newsletterId}/audience${suffix}`,
    );
  },
  syncNewsletterAudience: (newsletterId: string) =>
    scaleFetch<{
      added: number;
      updated: number;
      skipped: number;
      contactCount: number;
      activeCount: number;
    }>(`/scale/newsletters/${newsletterId}/audience/sync`, { method: "POST" }),
  testSendNewsletter: (newsletterId: string, to: string) =>
    scaleFetch<{ ok: true }>(`/scale/newsletters/${newsletterId}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  sendNewsletter: (newsletterId: string) =>
    scaleFetch<{
      newsletter: Newsletter;
      sent: number;
      failed: number;
      skipped: number;
      async?: boolean;
      queued?: number;
    }>(`/scale/newsletters/${newsletterId}/send`, { method: "POST" }),
  scheduleNewsletter: (newsletterId: string, runAt: string) =>
    scaleFetch<Newsletter>(`/scale/newsletters/${newsletterId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt }),
    }),
  cancelSchedule: (newsletterId: string) =>
    scaleFetch<Newsletter>(`/scale/newsletters/${newsletterId}/cancel-schedule`, {
      method: "POST",
    }),
  duplicateNewsletter: (newsletterId: string) =>
    scaleFetch<Newsletter>(`/scale/newsletters/${newsletterId}/duplicate`, {
      method: "POST",
    }),
  getNewsletterStats: (newsletterId: string) =>
    scaleFetch<{
      newsletter: Newsletter;
      dispatch: NewsletterDispatchProgress | null;
      recipients: NewsletterRecipient[];
      trackingEvents: NewsletterTrackingEvent[];
      linkClicks: NewsletterLinkClickStat[];
    }>(`/scale/newsletters/${newsletterId}/stats`),

  uploadNewsletterAsset: (
    newsletterId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    scaleFetch<{ url: string; key: string }>(`/scale/newsletters/${newsletterId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listTriggers: () => scaleFetch<{ triggers: Trigger[] }>("/scale/triggers"),
  getTriggerStatsOverview: () => scaleFetch<TriggerStatsOverview>("/scale/triggers/stats"),
  createTrigger: (input: {
    name: string;
    domain?: string;
    purpose?: TriggerPurpose;
    sourceType?: TriggerSource["type"];
  }) => scaleFetch<Trigger>("/scale/triggers", { method: "POST", body: JSON.stringify(input) }),
  getTrigger: (id: string) => scaleFetch<Trigger>(`/scale/triggers/${id}`),
  updateTrigger: (
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
      listStatus: TriggerListStatus;
      purpose: TriggerPurpose;
      source: TriggerSource;
      audienceGroupId: string | null;
      cooldownSeconds: number;
      applyMarketingSuppression: boolean;
      subject: string;
      previewText: string | null;
      bodyMarkdown: string;
      layoutId: string | null;
      messageTemplateId: string | null;
      templateVariables: Record<string, string>;
    }>,
  ) =>
    scaleFetch<Trigger>(`/scale/triggers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  activateTrigger: (id: string) =>
    scaleFetch<Trigger>(`/scale/triggers/${id}/activate`, { method: "POST" }),
  pauseTrigger: (id: string) =>
    scaleFetch<Trigger>(`/scale/triggers/${id}/pause`, { method: "POST" }),
  rotateTriggerWebhookSecret: (id: string) =>
    scaleFetch<{ trigger: Trigger; secret: string }>(
      `/scale/triggers/${id}/rotate-webhook-secret`,
      { method: "POST" },
    ),
  testSendTrigger: (
    id: string,
    input: { email: string; name?: string; payload?: Record<string, unknown> },
  ) =>
    scaleFetch<{ ok: true; triggerSendId: string; triggerEventId: string }>(
      `/scale/triggers/${id}/test-send`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  getTriggerActivity: (id: string) =>
    scaleFetch<{ triggerEvents: TriggerEvent[]; sends: TriggerSend[] }>(
      `/scale/triggers/${id}/activity`,
    ),
  getTriggerStats: (id: string) =>
    scaleFetch<{
      triggerId: string;
      stats: TriggerStats;
      lastTriggeredAt: string | null;
      lastSentAt: string | null;
    }>(`/scale/triggers/${id}/stats`),
  uploadTriggerAsset: (
    triggerId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    scaleFetch<{ url: string; key: string }>(`/scale/triggers/${triggerId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

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

export type TriggerStats = NewsletterStats & {
  triggered: number;
  matched: number;
  deduped: number;
};

export type Trigger = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  domain: string;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  complianceIdentityId: string | null;
  purpose: TriggerPurpose;
  listStatus: TriggerListStatus;
  status: TriggerStatus;
  source: TriggerSource;
  audienceGroupId: string | null;
  audienceGroupName: string | null;
  cooldownSeconds: number;
  applyMarketingSuppression: boolean;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  messageTemplateId: string | null;
  templateVariables: Record<string, string>;
  stats: TriggerStats;
  lastTriggeredAt: string | null;
  lastSentAt: string | null;
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

export type TriggerEvent = {
  id: string;
  triggerId: string | null;
  sourceType: TriggerSource["type"];
  idempotencyKey: string;
  recipientEmail: string;
  recipientName: string | null;
  payload: Record<string, unknown>;
  status: TriggerEventStatus;
  skipReason: string | null;
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
  audienceMemberId: string | null;
  email: string;
  name: string | null;
  status: TriggerSendStatus;
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
