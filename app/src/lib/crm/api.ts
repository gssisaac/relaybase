/**
 * hq/crm client — Broadcast (audience + send) model.
 */
import { CRM_API_BASE } from "./api-base";

export { CRM_API_BASE };

export type CrmTemplate = {
  id: string;
  name: string;
  htmlSource: string;
  isBuiltin: boolean;
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
  const res = await fetch(`${CRM_API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new CrmApiError(res.status, body?.error ?? `request failed (${res.status})`, body);
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
  compliance?: CrmAccountCompliance;
  defaultComplianceIdentityId: string | null;
  createdAt: string;
};

export const crmApi = {
  getAccountLink: () => crmFetch<CrmAccountLink>("/crm/account-link"),
  updateAccountLink: (input: {
    domain?: string | null;
    workerUrl?: string | null;
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
  importTemplate: (input: { name: string; htmlSource: string }) =>
    crmFetch<{ template: CrmTemplate; warnings: string[] }>("/crm/templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),

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
};
