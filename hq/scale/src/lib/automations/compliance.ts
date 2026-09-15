import { store } from "../../db/store";
import type { Automation } from "../../db/types";
import {
  accountDefaultComplianceIdentityId,
  complianceSettingsFromIdentity,
  findComplianceIdentity,
} from "../compliance/identity";

export function resolveComplianceIdentityForAutomation(automationId: string) {
  const data = store.read();
  const automation = data.automations.find((a) => a.id === automationId);
  if (!automation) return undefined;

  const explicit = automation.complianceIdentityId
    ? findComplianceIdentity(automation.complianceIdentityId)
    : undefined;
  if (explicit) return explicit;

  const defaultId = accountDefaultComplianceIdentityId(data);
  return defaultId ? findComplianceIdentity(defaultId) : undefined;
}

export function applyAutomationComplianceMergeTags(html: string, automationId: string): string {
  const identity = resolveComplianceIdentityForAutomation(automationId);
  const compliance = complianceSettingsFromIdentity(identity);
  return html
    .replaceAll("{{organization_name}}", compliance.organizationName?.trim() || "")
    .replaceAll("{{postal_address}}", compliance.postalAddress?.trim() || "")
    .replaceAll("{{compliance_contact_email}}", compliance.contactEmail?.trim() || "");
}

export function shouldIncludeListUnsubscribe(automation: Automation): boolean {
  return automation.purpose !== "transactional" && automation.applyMarketingSuppression;
}
