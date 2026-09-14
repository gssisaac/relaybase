/**
 * hq/crm is a separate service from the customer Worker (crm-mode-v0.2.md
 * §1.3) — CRM pages talk to it directly, not through `desktopAwareFetch` /
 * `email-api-map`. No auth wired up yet (single dev account server-side);
 * this client just points at the CRM base URL.
 *
 * Audience groups live in the CRM JSON store (`/crm/audience-groups`).
 */
import { CRM_API_BASE } from "./api-base";

export { CRM_API_BASE };

export type CampaignRecipient = {
  email: string;
  name?: string | null;
};

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

export type Campaign = {
  id: string;
  subject: string;
  bodyMarkdown: string;
  templateId: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  scheduledAt: string | null;
  sentAt: string | null;
  stats: { sent: number; opened: number; clicked: number };
  createdAt: string;
  updatedAt: string;
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

  listCampaigns: () => crmFetch<{ campaigns: Campaign[] }>("/crm/campaigns"),
  createCampaign: (input?: { subject?: string; templateId?: string }) =>
    crmFetch<Campaign>("/crm/campaigns", { method: "POST", body: JSON.stringify(input ?? {}) }),
  getCampaign: (id: string) => crmFetch<Campaign>(`/crm/campaigns/${id}`),
  updateCampaign: (
    id: string,
    input: Partial<{ subject: string; bodyMarkdown: string; templateId: string }>,
  ) => crmFetch<Campaign>(`/crm/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  sendCampaign: (id: string, recipients: CampaignRecipient[]) =>
    crmFetch<{ campaign: Campaign; sent: number; failed: number }>(
      `/crm/campaigns/${id}/send`,
      { method: "POST", body: JSON.stringify({ recipients }) },
    ),
  testSendCampaign: (id: string, to: string) =>
    crmFetch<{ ok: true }>(`/crm/campaigns/${id}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  scheduleCampaign: (id: string, runAt: string, recipients: CampaignRecipient[]) =>
    crmFetch<Campaign>(`/crm/campaigns/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt, recipients }),
    }),
  cancelSchedule: (id: string) =>
    crmFetch<Campaign>(`/crm/campaigns/${id}/cancel-schedule`, { method: "POST" }),

  uploadCampaignAsset: (
    campaignId: string,
    input: { filename: string; mimeType: string; contentBase64: string },
  ) =>
    crmFetch<{ url: string; key: string }>(`/crm/campaigns/${campaignId}/assets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
