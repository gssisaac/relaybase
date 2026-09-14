/**
 * hq/crm is a separate service from the customer Worker (crm-mode-v0.2.md
 * §1.3) — CRM pages talk to it directly, not through `desktopAwareFetch` /
 * `email-api-map`. No auth wired up yet (single dev account server-side);
 * this client just points at the CRM base URL.
 */
const CRM_API_BASE =
  process.env.NEXT_PUBLIC_CRM_API_BASE?.replace(/\/$/, "") ?? "http://localhost:32831";

export type Contact = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string;
  tags: string[];
  createdAt: string;
  lastActivityAt: string | null;
  lastReplyAt: string | null;
  followupSnoozed: boolean;
};

export type Activity = {
  id: string;
  type: string;
  payload: unknown;
  occurredAt: string;
};

export type PipelineColumn = {
  stage: "lead" | "contacted" | "quoted" | "won" | "lost";
  count: number;
  cards: {
    contactId: string;
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

async function crmFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  listContacts: (params?: { search?: string; status?: string; tag?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.tag) q.set("tag", params.tag);
    const qs = q.toString();
    return crmFetch<{ contacts: Contact[]; nextCursor: string | null }>(
      `/crm/contacts${qs ? `?${qs}` : ""}`,
    );
  },
  listFollowup: () =>
    crmFetch<{ contacts: Contact[]; thresholdDays: number }>("/crm/contacts/followup"),
  createContact: (input: { email: string; name?: string; tags?: string[]; status?: string }) =>
    crmFetch<Contact>("/crm/contacts", { method: "POST", body: JSON.stringify(input) }),
  getContact: (id: string) =>
    crmFetch<{ contact: Contact; activities: Activity[] }>(`/crm/contacts/${id}`),
  updateContact: (
    id: string,
    input: Partial<{ name: string; tags: string[]; status: string; followupSnoozed: boolean }>,
  ) => crmFetch<Contact>(`/crm/contacts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteContact: (id: string) =>
    crmFetch<{ ok: true }>(`/crm/contacts/${id}`, { method: "DELETE" }),

  getPipeline: () => crmFetch<{ columns: PipelineColumn[] }>("/crm/pipeline"),
  moveCard: (contactId: string, input: { stage?: string; note?: string }) =>
    crmFetch(`/crm/pipeline/${contactId}`, { method: "PATCH", body: JSON.stringify(input) }),

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
  sendCampaign: (id: string) =>
    crmFetch<{ campaign: Campaign; sent: number; failed: number }>(
      `/crm/campaigns/${id}/send`,
      { method: "POST" },
    ),
  testSendCampaign: (id: string, to: string) =>
    crmFetch<{ ok: true }>(`/crm/campaigns/${id}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  scheduleCampaign: (id: string, runAt: string) =>
    crmFetch<Campaign>(`/crm/campaigns/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ runAt }),
    }),
  cancelSchedule: (id: string) =>
    crmFetch<Campaign>(`/crm/campaigns/${id}/cancel-schedule`, { method: "POST" }),
};
