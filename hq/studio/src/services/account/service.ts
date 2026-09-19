import type { AccountLink, ComplianceIdentity } from "@db/types";
import { serializeAccountLink } from "@services/account/serialize";
import {
  accountDefaultComplianceIdentityId,
  complianceSettingsFromIdentity,
  findComplianceIdentity,
  listComplianceIdentities,
  resolveComplianceIdentityForBroadcast,
  serializeComplianceIdentity,
  syncAccountComplianceMirror,
} from "@services/account/identity";
import type { StudioDataStore } from "@db/types";
import { studioDocumentService } from "@services/studio/service";
import { complianceMergeValues } from "@services/account/footer";
import {
  isEmailSuppressedForGroup,
  upsertAccountSuppression,
} from "@services/account/suppression";
import { fetchWorkerCatalogDomainNames } from "@services/account/console-domains";
import { studioRepos } from "@services/repositories";

export class AccountService {
  private static instance: AccountService;

  static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService();
    }
    return AccountService.instance;
  }

  serializeAccountLink() {
    return serializeAccountLink();
  }

  defaultComplianceIdentityId(data: Parameters<typeof accountDefaultComplianceIdentityId>[0]) {
    return accountDefaultComplianceIdentityId(data);
  }

  listComplianceIdentities(accountLinkId?: string) {
    return listComplianceIdentities(accountLinkId);
  }

  findComplianceIdentity(id: string | null | undefined) {
    return findComplianceIdentity(id);
  }

  serializeComplianceIdentity(row: ComplianceIdentity) {
    return serializeComplianceIdentity(row);
  }

  complianceSettingsFromIdentity(input: Parameters<typeof complianceSettingsFromIdentity>[0]) {
    return complianceSettingsFromIdentity(input);
  }

  mutateDocument(mutator: (draft: StudioDataStore) => void) {
    return studioDocumentService.mutate(mutator);
  }

  readDocument() {
    return studioDocumentService.read();
  }

  resolveComplianceForBroadcast(broadcastId: string) {
    return resolveComplianceIdentityForBroadcast(broadcastId);
  }

  syncComplianceMirror(input: Parameters<typeof syncAccountComplianceMirror>[0]) {
    return syncAccountComplianceMirror(input);
  }

  complianceMergeValues(broadcastId?: string) {
    return complianceMergeValues(broadcastId);
  }

  isEmailSuppressed(email: string, groupId: string, accountLinkId?: string) {
    return isEmailSuppressedForGroup(email, groupId, accountLinkId);
  }

  upsertSuppression(input: Parameters<typeof upsertAccountSuppression>[0]) {
    return upsertAccountSuppression(input);
  }

  fetchConsoleDomainNames() {
    return fetchWorkerCatalogDomainNames();
  }

  async setWorkerUrl(accountLinkId: string, workerUrl: string): Promise<void> {
    const normalized = workerUrl.trim().replace(/\/$/, "");
    if (!normalized) return;
    await studioRepos.accountLink().update({ id: accountLinkId }, { workerUrl: normalized });
    studioDocumentService.mutate((draft) => {
      if (draft.account.id !== accountLinkId) return;
      draft.account.workerUrl = normalized;
    });
  }

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
        updatedAt: row.complianceUpdatedAt?.toISOString() ?? row.updatedAt.toISOString(),
      },
      defaultComplianceIdentityId: row.defaultComplianceIdentityId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const accountService = AccountService.getInstance();

/** @deprecated Use accountService */
export const accountLinkService = accountService;
