/**
 * hq/crm is a separate service from the customer Worker (crm-mode-v0.2.md
 * §1.3) — CRM pages talk to it directly, not through `desktopAwareFetch` /
 * `email-api-map`. No auth wired up yet (single dev account server-side);
 * this client just points at the CRM base URL.
 *
 * Data model: Campaign (consent scope / container) -> Subscriber
 * (campaign-scoped opt-in) -> Broadcast (atomic send) -> Recipient
 * (send-time snapshot). See
 * docs/features/crm-campaign-broadcast-subscriber-model.md.
 */
import { CRM_API_BASE } from "./api-base";

export { CRM_API_BASE };

export type PipelineColumn = {
  stage: "lead" | "contacted" | "quoted" | "won" | "lost";
  count: number;
  cards: {
    memberEmail: string;
    name: string | null;
    email: string;
    note: string | null;
    updatedAt: string;
  }[];
};

export type CrmTemplate = {
  id: string;
  name: string;
  htmlSource: string;
  isBuiltin: boolean;
  createdAt: string;
};

export type CampaignDataSource = {
  type: "generic_json";
  endpointUrl: string;
  credential?: string;
  credentialHeader?: string;
  cronEnabled?: boolean;
  cronIntervalMinutes?: number;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "error";
  lastSyncError?: string;
  lastSyncCount?: number;
};

export type CampaignStatus = "active" | "archived";

export type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  defaultTemplateId: string | null;
  status: CampaignStatus;
  dataSource?: CampaignDataSource;
  subscriberCount: number;
  broadcastCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SubscriberStatus = "subscribed" | "unsubscribed" | "pending" | "bounced";
export type SubscriberSource = "manual" | "sync" | "csv" | "webhook";

export type Subscriber = {
  id: string;
  campaignId: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  unsubscribedAt: string | null;
  bouncedAt: string | null;
  bounceReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type BroadcastStats = {
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
};

export type Broadcast = {
  id: string;
  campaignId: string;
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  templateId: string | null;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  stats: BroadcastStats;
  createdAt: string;
  updatedAt: string;
};

export type RecipientStatus = "queued" | "sending" | "sent" | "skipped" | "failed";

export type BroadcastRecipient = {
  id: string;
  email: string;
  name: string | null;
  status: RecipientStatus;
  errorMessage: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
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

export const crmApi = {
  getPipeline: () => crmFetch<{ columns: PipelineColumn[] }>("/crm/pipeline"),
  moveCard: (memberEmail: string, input: { stage?: string; note?: string; name?: string }) =>
    crmFetch(
      `/crm/pipeline/${encodeURIComponent(memberEmail)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),

  listTemplates: () => crmFetch<{ templates: CrmTemplate[] }>("/crm/templates"),
  importTemplate: (input: { name: string; htmlSource: string }) =>
    crmFetch<{ template: CrmTemplate; warnings: string[] }>("/crm/templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // --- Campaigns (consent scope / container) ---
  listCampaigns: () => crmFetch<{ campaigns: Campaign[] }>("/crm/campaigns"),
  createCampaign: (input: {
    name: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultTemplateId?: string;
  }) => crmFetch<Campaign>("/crm/campaigns", { method: "POST", body: JSON.stringify(input) }),
  getCampaign: (id: string) => crmFetch<Campaign>(`/crm/campaigns/${id}`),
  updateCampaign: (
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      fromName: string | null;
      fromEmail: string | null;
      replyTo: string | null;
      defaultTemplateId: string | null;
      status: CampaignStatus;
      dataSource: Partial<CampaignDataSource> | null;
    }>,
  ) => crmFetch<Campaign>(`/crm/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveCampaign: (id: string) =>
    crmFetch<Campaign>(`/crm/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    }),
  unarchiveCampaign: (id: string) =>
    crmFetch<Campaign>(`/crm/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    }),

  // --- Subscribers (campaign-scoped consent) ---
  listSubscribers: (campaignId: string, params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return crmFetch<{ subscribers: Subscriber[] }>(`/crm/campaigns/${campaignId}/subscribers${suffix}`);
  },
  addSubscriber: (campaignId: string, input: { email: string; name?: string; resubscribe?: boolean }) =>
    crmFetch<Subscriber>(`/crm/campaigns/${campaignId}/subscribers`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  importSubscribers: (campaignId: string, rows: Array<{ email: string; name?: string }>) =>
    crmFetch<{ added: number; updated: number; skipped: number }>(
      `/crm/campaigns/${campaignId}/subscribers/import`,
      { method: "POST", body: JSON.stringify({ rows }) },
    ),
  syncSubscribers: (campaignId: string) =>
    crmFetch<{ added: number; updated: number; skipped: number }>(
      `/crm/campaigns/${campaignId}/subscribers/sync`,
      { method: "POST" },
    ),
  removeSubscriber: (campaignId: string, subscriberId: string) =>
    crmFetch<{ ok: true }>(`/crm/campaigns/${campaignId}/subscribers/${subscriberId}`, {
      method: "DELETE",
    }),
  updateSubscriber: (campaignId: string, subscriberId: string, input: { status: "subscribed" | "unsubscribed" }) =>
    crmFetch<Subscriber>(`/crm/campaigns/${campaignId}/subscribers/${subscriberId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // --- Broadcasts (atomic send events) ---
  listBroadcasts: (campaignId: string) =>
    crmFetch<{ broadcasts: Broadcast[] }>(`/crm/campaigns/${campaignId}/broadcasts`),
  createBroadcast: (campaignId: string) =>
    crmFetch<Broadcast>(`/crm/campaigns/${campaignId}/broadcasts`, { method: "POST" }),
  getBroadcast: (campaignId: string, broadcastId: string) =>
    crmFetch<Broadcast>(`/crm/campaigns/${campaignId}/broadcasts/${broadcastId}`),
  updateBroadcast: (
    campaignId: string,
    broadcastId: string,
    input: Partial<{ subject: string; previewText: string; bodyMarkdown: string; templateId: string }>,
  ) =>
    crmFetch<Broadcast>(`/crm/campaigns/${campaignId}/broadcasts/${broadcastId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  testSendBroadcast: (campaignId: string, broadcastId: string, to: string) =>
    crmFetch<{ ok: true }>(`/crm/campaigns/${campaignId}/broadcasts/${broadcastId}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  sendBroadcast: (campaignId: string, broadcastId: string) =>
    crmFetch<{ broadcast: Broadcast; sent: number; failed: number; skipped: number }>(
      `/crm/campaigns/${campaignId}/broadcasts/${broadcastId}/send`,
      { method: "POST" },
    ),
  scheduleBroadcast: (campaignId: string, broadcastId: string, runAt: string) =>
    crmFetch<Broadcast>(`/crm/campaigns/${campaignId}/broadcasts/${broadcastId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt }),
    }),
  cancelSchedule: (campaignId: string, broadcastId: string) =>
    crmFetch<Broadcast>(`/crm/campaigns/${campaignId}/broadcasts/${broadcastId}/cancel-schedule`, {
      method: "POST",
    }),
  duplicateBroadcast: (campaignId: string, broadcastId: string) =>
    crmFetch<Broadcast>(`/crm/campaigns/${campaignId}/broadcasts/${broadcastId}/duplicate`, {
      method: "POST",
    }),
  getBroadcastStats: (campaignId: string, broadcastId: string) =>
    crmFetch<{ broadcast: Broadcast; recipients: BroadcastRecipient[] }>(
      `/crm/campaigns/${campaignId}/broadcasts/${broadcastId}/stats`,
    ),

  uploadCampaignAsset: (
    campaignId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    crmFetch<{ url: string; key: string }>(`/crm/campaigns/${campaignId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
