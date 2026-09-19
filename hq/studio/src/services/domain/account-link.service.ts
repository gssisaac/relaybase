import type { AccountLink } from "@db/types";
import { mutateStudioDocument } from "@services/studio/studio-document.service";
import { studioRepos } from "@services/repositories";

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function isoRequired(value: Date): string {
  return value.toISOString();
}

export const accountLinkService = {
  async setWorkerUrl(accountLinkId: string, workerUrl: string): Promise<void> {
    const normalized = workerUrl.trim().replace(/\/$/, "");
    if (!normalized) return;

    await studioRepos.accountLink().update({ id: accountLinkId }, { workerUrl: normalized });

    mutateStudioDocument((draft) => {
      if (draft.account.id !== accountLinkId) return;
      draft.account.workerUrl = normalized;
    });
  },

  async getAccount(accountLinkId: string): Promise<AccountLink | null> {
    const row = await studioRepos.accountLink().findOne({ where: { id: accountLinkId } });
    if (!row) return null;
    return {
      id: row.id,
      workerUrl: row.workerUrl,
      domain: row.domain,
      sendApiKey: row.sendApiKey ?? null,
      compliance: {
        organizationName: row.organizationName,
        postalAddress: row.postalAddress,
        contactEmail: row.contactEmail,
        updatedAt: iso(row.complianceUpdatedAt) ?? isoRequired(row.updatedAt),
      },
      defaultComplianceIdentityId: row.defaultComplianceIdentityId,
      createdAt: isoRequired(row.createdAt),
    };
  },
};
