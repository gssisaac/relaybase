import { store } from "../../db/store";
import {
  accountDefaultComplianceIdentityId,
  complianceSettingsFromIdentity,
  findComplianceIdentity,
  resolveComplianceIdentityForBroadcast,
} from "./identity";

export function complianceMergeValues(broadcastId?: string): {
  organizationName: string;
  postalAddress: string;
  complianceContactEmail: string;
} {
  let identity = broadcastId ? resolveComplianceIdentityForBroadcast(broadcastId) : undefined;
  if (!identity && broadcastId?.startsWith("msgtpl_")) {
    const defaultId = accountDefaultComplianceIdentityId(store.read());
    identity = defaultId ? findComplianceIdentity(defaultId) : undefined;
  }
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
