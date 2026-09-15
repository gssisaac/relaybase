import type { CrmComplianceIdentity } from "@/lib/crm/api";

export const ACCOUNT_DEFAULT_COMPLIANCE_VALUE = "__account_default__";

export function effectiveComplianceIdentityId(
  broadcastIdentityId: string | null | undefined,
  accountDefaultId: string | null | undefined,
): string | null {
  return broadcastIdentityId?.trim() || accountDefaultId?.trim() || null;
}

export function complianceFromIdentity(
  identity: CrmComplianceIdentity | null | undefined,
): {
  organizationName: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  updatedAt: string;
} {
  if (!identity) {
    return {
      organizationName: null,
      postalAddress: null,
      contactEmail: null,
      updatedAt: "",
    };
  }
  return {
    organizationName: identity.organizationName,
    postalAddress: identity.postalAddress,
    contactEmail: identity.contactEmail,
    updatedAt: identity.updatedAt,
  };
}

export function findComplianceIdentityById(
  identities: CrmComplianceIdentity[],
  id: string | null | undefined,
): CrmComplianceIdentity | null {
  if (!id) return null;
  return identities.find((row) => row.id === id) ?? null;
}
