import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { AccountComplianceSettings, ComplianceIdentity, ScaleDataStore } from "../../db/types";
import { newId } from "../shared/ids";

export function listComplianceIdentities(accountLinkId = DEV_ACCOUNT_LINK_ID): ComplianceIdentity[] {
  return store
    .read()
    .complianceIdentities.filter((row) => row.accountLinkId === accountLinkId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

export function findComplianceIdentity(id: string | null | undefined): ComplianceIdentity | undefined {
  if (!id) return undefined;
  return store.read().complianceIdentities.find((row) => row.id === id);
}

export function accountDefaultComplianceIdentityId(data: ScaleDataStore): string | null {
  const pinned = data.account.defaultComplianceIdentityId;
  if (pinned && data.complianceIdentities.some((row) => row.id === pinned)) return pinned;
  return data.complianceIdentities.find((row) => row.accountLinkId === data.account.id)?.id ?? null;
}

export function resolveComplianceIdentityForBroadcast(
  campaignId: string,
): ComplianceIdentity | undefined {
  const data = store.read();
  const broadcast = data.campaigns.find((b) => b.id === campaignId);
  if (!broadcast) return undefined;

  const explicit = broadcast.complianceIdentityId
    ? findComplianceIdentity(broadcast.complianceIdentityId)
    : undefined;
  if (explicit) return explicit;

  const defaultId = accountDefaultComplianceIdentityId(data);
  return defaultId ? findComplianceIdentity(defaultId) : undefined;
}

export function complianceSettingsFromIdentity(
  row: ComplianceIdentity | undefined,
): AccountComplianceSettings {
  const now = new Date().toISOString();
  if (!row) {
    return {
      organizationName: null,
      postalAddress: null,
      contactEmail: null,
      updatedAt: now,
    };
  }
  return {
    organizationName: row.organizationName,
    postalAddress: row.postalAddress,
    contactEmail: row.contactEmail,
    updatedAt: row.updatedAt,
  };
}

export function syncAccountComplianceMirror(draft: ScaleDataStore): void {
  const defaultId = accountDefaultComplianceIdentityId(draft);
  const identity = defaultId ? draft.complianceIdentities.find((row) => row.id === defaultId) : undefined;
  const now = new Date().toISOString();
  if (identity) {
    draft.account.compliance = {
      organizationName: identity.organizationName,
      postalAddress: identity.postalAddress,
      contactEmail: identity.contactEmail,
      updatedAt: identity.updatedAt,
    };
    draft.account.defaultComplianceIdentityId = identity.id;
    return;
  }
  if (!draft.account.compliance) {
    draft.account.compliance = {
      organizationName: null,
      postalAddress: null,
      contactEmail: null,
      updatedAt: now,
    };
  }
}

export function ensureComplianceIdentitiesFromLegacy(draft: ScaleDataStore, now: string): void {
  if (!draft.complianceIdentities) draft.complianceIdentities = [];

  if (draft.complianceIdentities.length === 0) {
    const legacy = draft.account.compliance;
    const id = newId("compliance");
    draft.complianceIdentities.push({
      id,
      accountLinkId: draft.account.id,
      name: legacy.organizationName?.trim() || "Default sender",
      organizationName: legacy.organizationName ?? null,
      postalAddress: legacy.postalAddress ?? null,
      contactEmail: legacy.contactEmail ?? null,
      createdAt: now,
      updatedAt: legacy.updatedAt ?? now,
    });
    draft.account.defaultComplianceIdentityId = id;
  }

  if (draft.account.defaultComplianceIdentityId === undefined) {
    draft.account.defaultComplianceIdentityId =
      draft.complianceIdentities.find((row) => row.accountLinkId === draft.account.id)?.id ?? null;
  }

  for (const row of draft.campaigns) {
    if (row.complianceIdentityId === undefined) row.complianceIdentityId = null;
  }

  syncAccountComplianceMirror(draft);
}

export function serializeComplianceIdentity(row: ComplianceIdentity) {
  return {
    id: row.id,
    name: row.name,
    organizationName: row.organizationName,
    postalAddress: row.postalAddress,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
