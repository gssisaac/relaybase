import type {
  AudienceGroupContact,
  AudienceGroupSummary,
} from "@/email/components/mailbox/types";

import { StudioApiError, studioFetch } from "@/lib/studio/api";

export type CrmAudienceGroupDetail = {
  group: AudienceGroupSummary;
  contacts: AudienceGroupContact[];
};

export { StudioApiError };

export const studioAudienceApi = {
  listGroups: () => studioFetch<{ groups: AudienceGroupSummary[] }>("/studio/audience-groups"),

  getGroup: (groupId: string) =>
    studioFetch<CrmAudienceGroupDetail>(`/studio/audience-groups/${encodeURIComponent(groupId)}`),

  testConnection: (input: {
    endpointUrl?: string;
    credential?: string;
    credentialHeader?: string;
    groupId?: string;
  }) =>
    studioFetch<{
      ok: boolean;
      error?: string;
      totalCount?: number;
      skippedCount?: number;
      sampleContacts?: Array<{ email: string; name?: string }>;
    }>("/studio/audience-groups/test", {
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
    studioFetch<{ group: AudienceGroupSummary }>("/studio/audience-groups", {
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
    studioFetch<CrmAudienceGroupDetail>(`/studio/audience-groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteGroup: (groupId: string) =>
    studioFetch<{ ok: true }>(`/studio/audience-groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
    }),

  addContact: (groupId: string, input: { email: string; name?: string }) =>
    studioFetch<{ contact: AudienceGroupContact }>(
      `/studio/audience-groups/${encodeURIComponent(groupId)}/contacts`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  removeContact: (groupId: string, contactId: string) =>
    studioFetch<{ ok: true }>(
      `/studio/audience-groups/${encodeURIComponent(groupId)}/contacts?contactId=${encodeURIComponent(contactId)}`,
      { method: "DELETE" },
    ),

  updateContactSendStatus: (
    groupId: string,
    contactId: string,
    sendStatus: "active" | "unsubscribed",
  ) =>
    studioFetch<{ contact: AudienceGroupContact }>(
      `/studio/audience-groups/${encodeURIComponent(groupId)}/contacts/${encodeURIComponent(contactId)}`,
      { method: "PATCH", body: JSON.stringify({ sendStatus }) },
    ),
};
