/**
 * hq/studio client — Newsletter (subscriber + send) and Trigger models.
 */
import {
  getStudioApiBase,
  STUDIO_API_REQUEST_HEADER,
  STUDIO_PUBLIC_LINK_ORIGIN,
} from "@/studio/lib/studio-origin";

export { getStudioApiBase, STUDIO_PUBLIC_LINK_ORIGIN } from "@/studio/lib/studio-origin";
export { studioSubscriberApi } from "./subscriber-api";
export {
  verifiedDestinationApi,
  VerifiedDestinationApiError,
  type CfVerifiedDestinationAddress,
} from "./verified-destination-api";

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
export type StudioLayout = {
  id: string;
  name: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null;
  isBuiltin: boolean;
  derivedFromLayoutId: string | null;
  createdAt: string;
};

export type TemplateCategory =
  | "transactional"
  | "marketing"
  | "newsletter"
  | "conversational";

/** Read-only catalog blueprint (`/studio/templates`). */
export type StudioTemplate = {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string;
  templateVariables: Record<string, string>;
  category: TemplateCategory | null;
  isBuiltin: true;
  createdAt: string;
  updatedAt: string;
};

export type MessageLinkedOwner = {
  kind: "trigger" | "newsletter";
  id: string;
  name: string;
};

/** Editable message copy (`/studio/messages`). */
export type StudioMessage = {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  templateVariables: Record<string, string>;
  forkedFromTemplateId: string | null;
  linkedOwner: MessageLinkedOwner | null;
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
  slug: string;
  description: string | null;
  subscriberGroupId: string | null;
  subscriberGroupName: string | null;
  subscriberGroupDomain: string | null;
  domain: string | null;
  subscriberContactCount: number | null;
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
  messageId: string | null;
  templateVariables: Record<string, string>;
  status: NewsletterStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  stats: NewsletterStats;
  subscriberActiveCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterMemberStatus = "active" | "unsubscribed" | "bounced";
export type NewsletterMemberSource = "manual" | "synced";

export type NewsletterMember = {
  id: string;
  newsletterId: string;
  subscriberMemberId: string;
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
  bySubscriberGroup: {
    subscriberGroupId: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
  }[];
  newsletters: Array<{
    id: string;
    subject: string;
    status: NewsletterStatus;
    sentAt: string | null;
    finishedAt: string | null;
    stats: NewsletterStats;
    subscriberGroupName: string | null;
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

export type StudioOverview = {
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
      subject: string;
      scheduledAt: string;
      subscriberGroupName: string | null;
      recipientCount: number;
      status: NewsletterStatus;
    } | null;
    upcomingCount: number;
    upcomingList: Array<{
      id: string;
      subject: string;
      scheduledAt: string;
      status: "scheduled" | "sending";
      subscriberGroupName: string | null;
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
      subject: string;
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
  subscribers: {
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
    subscriberHealth: Array<{ key: string; label: string; count: number }>;
    automationTriggersByDay: Array<{ day: string; label: string; count: number }>;
    engagementRates: Array<{ key: string; label: string; value: number }>;
  };
};

export type StudioDashboardSendingAggregate = {
  newsletterCount: number;
  recipientTotal: number;
  processed: number;
  remaining: number;
  queued: number;
  inFlight: number;
  delivered: number;
  failed: number;
  bounced: number;
  skipped: number;
  failureRate: number;
  overallPercent: number;
  latestEtaIso: string | null;
  throughputPerMin: number | null;
};

export type StudioDashboardPayload = {
  generatedAt: string;
  sending: StudioDashboardSendingAggregate | null;
  templates: StudioTemplate[];
  layouts: StudioLayout[];
  schedule: {
    nextUpcoming: {
      id: string;
      subject: string;
      scheduledAt: string;
      subscriberGroupName: string | null;
      recipientCount: number;
      status: NewsletterStatus;
    } | null;
    upcomingCount: number;
    upcomingList: Array<{
      id: string;
      subject: string;
      scheduledAt: string;
      status: "scheduled" | "sending";
      subscriberGroupName: string | null;
    }>;
  };
  subscribers: {
    groupCount: number;
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
  subscriberMemberId: string;
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

class StudioApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;
  constructor(status: number, message: string, body: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function studioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { getHqAccessToken } = await import("@/lib/hq-auth/session");
  const hqToken = getHqAccessToken();
  const res = await fetch(`${getStudioApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      [STUDIO_API_REQUEST_HEADER]: "1",
      ...(hqToken ? { Authorization: `Bearer ${hqToken}` } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback =
      body?.error ??
      (body === null && res.headers.get("content-type")?.includes("text/html")
        ? "Studio API returned HTML — is hq/studio running (pnpm dev in hq/studio)?"
        : `request failed (${res.status})`);
    throw new StudioApiError(res.status, fallback, body);
  }
  if (body === null) {
    throw new StudioApiError(
      res.status,
      "Studio API returned a non-JSON response — is hq/studio running on port 32832?",
      null,
    );
  }
  return body as T;
}

export { StudioApiError };

export type StudioAccountCompliance = {
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  updatedAt: string;
};

export type StudioComplianceIdentity = {
  id: string;
  name: string;
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioAccountLink = {
  id: string;
  workerUrl: string | null;
  domain: string | null;
  sendApiKeyConfigured?: boolean;
  compliance?: StudioAccountCompliance;
  defaultComplianceIdentityId: string | null;
  createdAt: string;
};

export const studioApi = {
  listWorkerCatalogDomains: () =>
    studioFetch<{ domains: string[] }>("/studio/worker-catalog/domains"),

  getAccountLink: () => studioFetch<StudioAccountLink>("/studio/account-link"),
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
    studioFetch<StudioAccountLink>("/studio/account-link", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  listComplianceIdentities: () =>
    studioFetch<{
      identities: StudioComplianceIdentity[];
      defaultComplianceIdentityId: string | null;
    }>("/studio/compliance-identities"),
  createComplianceIdentity: (input: {
    name?: string;
    organizationName?: string | null;
    postalAddress?: string | null;
    contactEmail?: string | null;
    setAsDefault?: boolean;
  }) =>
    studioFetch<{ identity: StudioComplianceIdentity }>("/studio/compliance-identities", {
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
    studioFetch<{ identity: StudioComplianceIdentity }>(`/studio/compliance-identities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  listLayouts: () => studioFetch<{ layouts: StudioLayout[] }>("/studio/layouts"),
  getLayout: (id: string) => studioFetch<{ layout: StudioLayout }>(`/studio/layouts/${id}`),
  deleteLayout: (id: string) =>
    studioFetch<{ ok: true }>(`/studio/layouts/${id}`, { method: "DELETE" }),
  importLayout: (input: { name: string; htmlSource: string; variablesYaml?: string }) =>
    studioFetch<{ layout: StudioLayout; warnings: string[] }>("/studio/layouts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveLayoutSource: (id: string, input: { htmlSource: string; name?: string }) =>
    studioFetch<{ layout: StudioLayout; forked: boolean; warnings: string[] }>(
      `/studio/layouts/${id}/source`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  listTemplates: () => studioFetch<{ templates: StudioTemplate[] }>("/studio/templates"),
  getTemplate: (id: string) =>
    studioFetch<{ template: StudioTemplate }>(`/studio/templates/${id}`),
  useTemplate: (templateId: string, input?: { name?: string }) =>
    studioFetch<{ message: StudioMessage }>(`/studio/templates/${templateId}/use`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    }),

  listMessages: () => studioFetch<{ messages: StudioMessage[] }>("/studio/messages"),
  getMessage: (id: string) => studioFetch<{ message: StudioMessage }>(`/studio/messages/${id}`),
  createMessage: (input: {
    name: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    forkedFromTemplateId?: string | null;
  }) =>
    studioFetch<{ message: StudioMessage }>("/studio/messages", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMessage: (
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
    studioFetch<{ message: StudioMessage }>(`/studio/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  uploadMessageAsset: (
    messageId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    studioFetch<{ url: string; key: string }>(`/studio/messages/${messageId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  testSendMessage: (
    messageId: string,
    input: {
      to: string;
      fromEmail: string;
      fromName?: string | null;
      replyTo?: string | null;
      mergeTags?: Record<string, string>;
    },
  ) =>
    studioFetch<{ ok: true }>(`/studio/messages/${messageId}/test-send`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteMessage: (id: string) =>
    studioFetch<{ ok: true }>(`/studio/messages/${id}`, { method: "DELETE" }),

  getOverview: () => studioFetch<StudioOverview>("/studio/overview"),
  getDashboard: () => studioFetch<StudioDashboardPayload>("/studio/dashboard"),
  listNewsletters: () => studioFetch<{ newsletters: Newsletter[] }>("/studio/newsletters"),
  getSentOverview: () => studioFetch<AccountSentOverview>("/studio/newsletters/sent-stats"),
  getInProgressOverview: () => studioFetch<InProgressOverview>("/studio/newsletters/in-progress"),
  createNewsletter: (input: {
    domain?: string;
    subscriberGroupId?: string;
    workerUrl?: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultLayoutId?: string;
  }) => studioFetch<Newsletter>("/studio/newsletters", { method: "POST", body: JSON.stringify(input) }),
  getNewsletter: (id: string) => studioFetch<Newsletter>(`/studio/newsletters/${id}`),
  updateNewsletter: (
    id: string,
    input: Partial<{
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
      layoutId: string | null;
      messageId: string | null;
      templateVariables: Record<string, string>;
      subscriberGroupId: string;
    }>,
  ) => studioFetch<Newsletter>(`/studio/newsletters/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveNewsletter: (id: string) =>
    studioFetch<Newsletter>(`/studio/newsletters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "archived" }),
    }),
  unarchiveNewsletter: (id: string) =>
    studioFetch<Newsletter>(`/studio/newsletters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ listStatus: "active" }),
    }),

  listNewsletterSubscribers: (newsletterId: string, params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return studioFetch<{ members: NewsletterMember[] }>(
      `/studio/newsletters/${newsletterId}/subscribers${suffix}`,
    );
  },
  syncNewsletterSubscribers: (newsletterId: string) =>
    studioFetch<{
      added: number;
      updated: number;
      skipped: number;
      contactCount: number;
      activeCount: number;
    }>(`/studio/newsletters/${newsletterId}/subscribers/sync`, { method: "POST" }),
  testSendNewsletter: (newsletterId: string, to: string) =>
    studioFetch<{ ok: true }>(`/studio/newsletters/${newsletterId}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  sendNewsletter: (newsletterId: string) =>
    studioFetch<{
      newsletter: Newsletter;
      sent: number;
      failed: number;
      skipped: number;
      async?: boolean;
      queued?: number;
    }>(`/studio/newsletters/${newsletterId}/send`, { method: "POST" }),
  scheduleNewsletter: (newsletterId: string, runAt: string) =>
    studioFetch<Newsletter>(`/studio/newsletters/${newsletterId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt }),
    }),
  cancelSchedule: (newsletterId: string) =>
    studioFetch<Newsletter>(`/studio/newsletters/${newsletterId}/cancel-schedule`, {
      method: "POST",
    }),
  duplicateNewsletter: (newsletterId: string) =>
    studioFetch<Newsletter>(`/studio/newsletters/${newsletterId}/duplicate`, {
      method: "POST",
    }),
  getNewsletterStats: (newsletterId: string) =>
    studioFetch<{
      newsletter: Newsletter;
      dispatch: NewsletterDispatchProgress | null;
      recipients: NewsletterRecipient[];
      trackingEvents: NewsletterTrackingEvent[];
      linkClicks: NewsletterLinkClickStat[];
    }>(`/studio/newsletters/${newsletterId}/stats`),

  uploadNewsletterAsset: (
    newsletterId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    studioFetch<{ url: string; key: string }>(`/studio/newsletters/${newsletterId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listTriggers: () => studioFetch<{ triggers: Trigger[] }>("/studio/triggers"),
  getTriggerStatsOverview: () => studioFetch<TriggerStatsOverview>("/studio/triggers/stats"),
  createTrigger: (input: {
    name: string;
    domain?: string;
    purpose?: TriggerPurpose;
    sourceType?: TriggerSource["type"];
  }) => studioFetch<Trigger>("/studio/triggers", { method: "POST", body: JSON.stringify(input) }),
  getTrigger: (id: string) => studioFetch<Trigger>(`/studio/triggers/${id}`),
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
      subscriberGroupId: string | null;
      cooldownSeconds: number;
      applyMarketingSuppression: boolean;
      subject: string;
      previewText: string | null;
      bodyMarkdown: string;
      layoutId: string | null;
      templateVariables: Record<string, string>;
    }>,
  ) =>
    studioFetch<Trigger>(`/studio/triggers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  activateTrigger: (id: string) =>
    studioFetch<Trigger>(`/studio/triggers/${id}/activate`, { method: "POST" }),
  pauseTrigger: (id: string) =>
    studioFetch<Trigger>(`/studio/triggers/${id}/pause`, { method: "POST" }),
  rotateTriggerWebhookSecret: (id: string) =>
    studioFetch<{ trigger: Trigger; secret: string }>(
      `/studio/triggers/${id}/rotate-webhook-secret`,
      { method: "POST" },
    ),
  testSendTrigger: (
    id: string,
    input: { email: string; name?: string; payload?: Record<string, unknown> },
  ) =>
    studioFetch<{ ok: true; triggerSendId: string; triggerEventId: string }>(
      `/studio/triggers/${id}/test-send`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  getTriggerActivity: (id: string) =>
    studioFetch<{ triggerEvents: TriggerEvent[]; sends: TriggerSend[] }>(
      `/studio/triggers/${id}/activity`,
    ),
  getTriggerStats: (id: string) =>
    studioFetch<{
      triggerId: string;
      stats: TriggerStats;
      lastTriggeredAt: string | null;
      lastSentAt: string | null;
    }>(`/studio/triggers/${id}/stats`),
  uploadTriggerAsset: (
    triggerId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    studioFetch<{ url: string; key: string }>(`/studio/triggers/${triggerId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

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
  subscriberGroupId: string | null;
  subscriberGroupName: string | null;
  cooldownSeconds: number;
  applyMarketingSuppression: boolean;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  messageId: string | null;
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
  subscriberMemberId: string | null;
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
