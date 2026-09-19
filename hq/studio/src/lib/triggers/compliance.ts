import { studioService } from "@services/studio-service";
import type { Trigger } from "@db/types";
import {
  accountDefaultComplianceIdentityId,
  complianceSettingsFromIdentity,
  findComplianceIdentity,
} from "@lib/compliance/identity";

export function resolveComplianceIdentityForAutomation(triggerId: string) {
  const data = studioService.read();
  const automation = data.triggers.find((a) => a.id === triggerId);
  if (!automation) return undefined;

  const explicit = automation.complianceIdentityId
    ? findComplianceIdentity(automation.complianceIdentityId)
    : undefined;
  if (explicit) return explicit;

  const defaultId = accountDefaultComplianceIdentityId(data);
  return defaultId ? findComplianceIdentity(defaultId) : undefined;
}

export function applyTriggerComplianceMergeTags(html: string, triggerId: string): string {
  const identity = resolveComplianceIdentityForAutomation(triggerId);
  const compliance = complianceSettingsFromIdentity(identity);
  return html
    .replaceAll("{{organization_name}}", compliance.organizationName?.trim() || "")
    .replaceAll("{{postal_address}}", compliance.postalAddress?.trim() || "")
    .replaceAll("{{compliance_contact_email}}", compliance.contactEmail?.trim() || "");
}

export function shouldIncludeListUnsubscribe(automation: Trigger): boolean {
  return automation.purpose !== "transactional" && automation.applyMarketingSuppression;
}
