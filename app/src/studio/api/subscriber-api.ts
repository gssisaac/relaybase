import type {
  SubscriberGroupContact,
  SubscriberGroupSummary,
} from "@/email/components/mailbox/types";

import { StudioApiError, studioFetch } from "@/studio/api";

export type CrmSubscriberGroupDetail = {
  group: SubscriberGroupSummary;
  contacts: SubscriberGroupContact[];
};

export { StudioApiError };

export const studioSubscriberApi = {
  listGroups: () => studioFetch<{ groups: SubscriberGroupSummary[] }>("/studio/subscriber-groups"),

  getGroup: (groupId: string) =>
    studioFetch<CrmSubscriberGroupDetail>(`/studio/subscriber-groups/${encodeURIComponent(groupId)}`),

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
    }>("/studio/subscriber-groups/test", {
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
    studioFetch<{ group: SubscriberGroupSummary }>("/studio/subscriber-groups", {
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
    studioFetch<CrmSubscriberGroupDetail>(`/studio/subscriber-groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteGroup: (groupId: string) =>
    studioFetch<{ ok: true }>(`/studio/subscriber-groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
    }),

  addContact: (groupId: string, input: { email: string; name?: string }) =>
    studioFetch<{ contact: SubscriberGroupContact }>(
      `/studio/subscriber-groups/${encodeURIComponent(groupId)}/contacts`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  removeContact: (groupId: string, contactId: string) =>
    studioFetch<{ ok: true }>(
      `/studio/subscriber-groups/${encodeURIComponent(groupId)}/contacts?contactId=${encodeURIComponent(contactId)}`,
      { method: "DELETE" },
    ),

  updateContactSendStatus: (
    groupId: string,
    contactId: string,
    sendStatus: "active" | "unsubscribed",
  ) =>
    studioFetch<{ contact: SubscriberGroupContact }>(
      `/studio/subscriber-groups/${encodeURIComponent(groupId)}/contacts/${encodeURIComponent(contactId)}`,
      { method: "PATCH", body: JSON.stringify({ sendStatus }) },
    ),
};
