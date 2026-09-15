import type { ScaleComplianceIdentity } from "@/lib/scale/api";

export const ACCOUNT_DEFAULT_COMPLIANCE_VALUE = "__account_default__";

export function effectiveComplianceIdentityId(
  campaignIdentityId: string | null | undefined,
  accountDefaultId: string | null | undefined,
): string | null {
  return campaignIdentityId?.trim() || accountDefaultId?.trim() || null;
}

export function complianceFromIdentity(
  identity: ScaleComplianceIdentity | null | undefined,
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
  identities: ScaleComplianceIdentity[],
  id: string | null | undefined,
): ScaleComplianceIdentity | null {
  if (!id) return null;
  return identities.find((row) => row.id === id) ?? null;
}
