import {
  complianceSettingsFromIdentity,
  resolveComplianceIdentityForBroadcast,
} from "./identity";

export function complianceMergeValues(broadcastId?: string): {
  organizationName: string;
  postalAddress: string;
  complianceContactEmail: string;
} {
  const identity = broadcastId ? resolveComplianceIdentityForBroadcast(broadcastId) : undefined;
  const compliance = complianceSettingsFromIdentity(identity);
  return {
    organizationName: compliance.organizationName?.trim() || "",
    postalAddress: compliance.postalAddress?.trim() || "",
    complianceContactEmail: compliance.contactEmail?.trim() || "",
  };
}

export function applyComplianceMergeTags(html: string, broadcastId?: string): string {
  const v = complianceMergeValues(broadcastId);
  return html
    .replaceAll("{{organization_name}}", v.organizationName)
    .replaceAll("{{postal_address}}", v.postalAddress)
    .replaceAll("{{compliance_contact_email}}", v.complianceContactEmail);
}
