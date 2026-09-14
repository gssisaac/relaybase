import { crmAudienceApi } from "@/lib/crm/audience-api";

export type AudienceRecipient = {
  email: string;
  name?: string | null;
};

/** Unique recipients across all CRM audience groups. */
export async function fetchAllAudienceRecipients(): Promise<AudienceRecipient[]> {
  const { groups } = await crmAudienceApi.listGroups();
  const byEmail = new Map<string, AudienceRecipient>();

  for (const group of groups) {
    const detail = await crmAudienceApi.getGroup(group.id);
    for (const row of detail.contacts) {
      const email = row.email?.trim().toLowerCase();
      if (!email?.includes("@")) continue;
      if (!byEmail.has(email)) {
        byEmail.set(email, { email, name: row.name?.trim() || null });
      }
    }
  }

  return [...byEmail.values()];
}

export async function fetchAudienceRecipientCount(): Promise<number> {
  const recipients = await fetchAllAudienceRecipients();
  return recipients.length;
}
