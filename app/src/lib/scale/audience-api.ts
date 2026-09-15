import type {
  AudienceGroupContact,
  AudienceGroupSummary,
} from "@/email/components/mailbox/types";

import { ScaleApiError, scaleFetch } from "@/lib/scale/api";

export type CrmAudienceGroupDetail = {
  group: AudienceGroupSummary;
  contacts: AudienceGroupContact[];
};

export { ScaleApiError };

export const scaleAudienceApi = {
  listGroups: () => scaleFetch<{ groups: AudienceGroupSummary[] }>("/scale/audience-groups"),

  getGroup: (groupId: string) =>
    scaleFetch<CrmAudienceGroupDetail>(`/scale/audience-groups/${encodeURIComponent(groupId)}`),

  testConnection: (input: {
    endpointUrl?: string;
    credential?: string;
    credentialHeader?: string;
    groupId?: string;
  }) =>
    scaleFetch<{
      ok: boolean;
      error?: string;
      totalCount?: number;
      skippedCount?: number;
      sampleContacts?: Array<{ email: string; name?: string }>;
    }>("/scale/audience-groups/test", {
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
    scaleFetch<{ group: AudienceGroupSummary }>("/scale/audience-groups", {
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
    scaleFetch<CrmAudienceGroupDetail>(`/scale/audience-groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteGroup: (groupId: string) =>
    scaleFetch<{ ok: true }>(`/scale/audience-groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
    }),

  addContact: (groupId: string, input: { email: string; name?: string }) =>
    scaleFetch<{ contact: AudienceGroupContact }>(
      `/scale/audience-groups/${encodeURIComponent(groupId)}/contacts`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  removeContact: (groupId: string, contactId: string) =>
    scaleFetch<{ ok: true }>(
      `/scale/audience-groups/${encodeURIComponent(groupId)}/contacts?contactId=${encodeURIComponent(contactId)}`,
      { method: "DELETE" },
    ),

  updateContactSendStatus: (
    groupId: string,
    contactId: string,
    sendStatus: "active" | "unsubscribed",
  ) =>
    scaleFetch<{ contact: AudienceGroupContact }>(
      `/scale/audience-groups/${encodeURIComponent(groupId)}/contacts/${encodeURIComponent(contactId)}`,
      { method: "PATCH", body: JSON.stringify({ sendStatus }) },
    ),
};
