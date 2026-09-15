import type {
  AudienceGroupContact,
  AudienceGroupSummary,
} from "@/email/components/mailbox/types";

import { CrmApiError, crmFetch } from "@/lib/crm/api";

export type CrmAudienceGroupDetail = {
  group: AudienceGroupSummary;
  contacts: AudienceGroupContact[];
};

export { CrmApiError };

export const crmAudienceApi = {
  listGroups: () => crmFetch<{ groups: AudienceGroupSummary[] }>("/crm/audience-groups"),

  getGroup: (groupId: string) =>
    crmFetch<CrmAudienceGroupDetail>(`/crm/audience-groups/${encodeURIComponent(groupId)}`),

  testConnection: (input: {
    endpointUrl?: string;
    credential?: string;
    credentialHeader?: string;
    groupId?: string;
  }) =>
    crmFetch<{
      ok: boolean;
      error?: string;
      totalCount?: number;
      skippedCount?: number;
      sampleContacts?: Array<{ email: string; name?: string }>;
    }>("/crm/audience-groups/test", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  createGroup: (input: {
    name: string;
    domain: string;
    workerUrl?: string;
    dataSource?: {
      type: "generic_json";
      endpointUrl: string;
      credential?: string;
      credentialHeader?: string;
    };
  }) =>
    crmFetch<{ group: AudienceGroupSummary }>("/crm/audience-groups", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateGroup: (
    groupId: string,
    input: Partial<{
      name: string;
      domain: string;
      workerUrl?: string;
      defaultFrom: string | null;
      cronEnabled: boolean;
      cronIntervalMinutes: number;
      dataSource: {
        type: "generic_json";
        endpointUrl: string;
        credential?: string;
        credentialHeader?: string;
      } | null;
    }>,
  ) =>
    crmFetch<CrmAudienceGroupDetail>(`/crm/audience-groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteGroup: (groupId: string) =>
    crmFetch<{ ok: true }>(`/crm/audience-groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
    }),

  addContact: (groupId: string, input: { email: string; name?: string }) =>
    crmFetch<{ contact: AudienceGroupContact }>(
      `/crm/audience-groups/${encodeURIComponent(groupId)}/contacts`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  removeContact: (groupId: string, contactId: string) =>
    crmFetch<{ ok: true }>(
      `/crm/audience-groups/${encodeURIComponent(groupId)}/contacts?contactId=${encodeURIComponent(contactId)}`,
      { method: "DELETE" },
    ),

  updateContactSendStatus: (
    groupId: string,
    contactId: string,
    sendStatus: "active" | "unsubscribed",
  ) =>
    crmFetch<{ contact: AudienceGroupContact }>(
      `/crm/audience-groups/${encodeURIComponent(groupId)}/contacts/${encodeURIComponent(contactId)}`,
      { method: "PATCH", body: JSON.stringify({ sendStatus }) },
    ),
};
