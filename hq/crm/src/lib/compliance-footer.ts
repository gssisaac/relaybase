import { store } from "../db/store";

export function complianceMergeValues(): {
  organizationName: string;
  postalAddress: string;
  complianceContactEmail: string;
} {
  const compliance = store.read().account.compliance;
  return {
    organizationName: compliance.organizationName?.trim() || "",
    postalAddress: compliance.postalAddress?.trim() || "",
    complianceContactEmail: compliance.contactEmail?.trim() || "",
  };
}

export function applyComplianceMergeTags(html: string): string {
  const v = complianceMergeValues();
  return html
    .replaceAll("{{organization_name}}", v.organizationName)
    .replaceAll("{{postal_address}}", v.postalAddress)
    .replaceAll("{{compliance_contact_email}}", v.complianceContactEmail);
}
