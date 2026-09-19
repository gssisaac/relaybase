import type { StudioComplianceIdentity } from "@/studio/api";

export const ACCOUNT_DEFAULT_COMPLIANCE_VALUE = "__account_default__";

export function effectiveComplianceIdentityId(
  newsletterIdentityId: string | null | undefined,
  accountDefaultId: string | null | undefined,
): string | null {
  return newsletterIdentityId?.trim() || accountDefaultId?.trim() || null;
}

export function complianceFromIdentity(
  identity: StudioComplianceIdentity | null | undefined,
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
  identities: StudioComplianceIdentity[],
  id: string | null | undefined,
): StudioComplianceIdentity | null {
  if (!id) return null;
  return identities.find((row) => row.id === id) ?? null;
}
