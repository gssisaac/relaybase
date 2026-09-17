import {
  isLogoFooterTemplateVariableField,
  missingRequiredTemplateVariables,
} from "@/studio/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/studio/lib/layouts/layout-standard-footer";
import type { StudioAccountCompliance, TemplateVariablesSchema } from "@/studio/api";

export type PreflightCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
};

export function runNewsletterPreflight(input: {
  subject: string;
  bodyMarkdown: string;
  templateHtml: string;
  templateId?: string | null;
  templateVariablesSchema?: TemplateVariablesSchema | null;
  templateVariables?: Record<string, string>;
  fromEmail: string | null;
  fromName: string | null;
  compliance: StudioAccountCompliance | null | undefined;
}): PreflightCheck[] {
  const preparedTemplate = prepareLayoutTemplateHtml(
    input.templateHtml,
    input.templateId,
  );
  const combined = `${preparedTemplate}\n${input.bodyMarkdown}`;
  const hasUnsubscribeInTemplate =
    combined.includes("{{unsubscribe_url}}") || combined.includes("{{compliance_footer}}");
  const compliance = input.compliance;
  const missingVars = missingRequiredTemplateVariables(
    input.templateVariablesSchema,
    input.templateVariables,
    compliance?.organizationName,
  );

  const checks: PreflightCheck[] = [
    {
      id: "subject",
      label: "Subject line",
      status: input.subject.trim() ? "pass" : "fail",
      detail: input.subject.trim() ? undefined : "Required before send (Publish tab).",
    },
    {
      id: "body",
      label: "Email body",
      status: input.bodyMarkdown.trim() ? "pass" : "warn",
      detail: input.bodyMarkdown.trim() ? undefined : "Empty body — add content in the editor.",
    },
    {
      id: "unsubscribe",
      label: "Unsubscribe link",
      status: hasUnsubscribeInTemplate ? "pass" : "warn",
      detail: hasUnsubscribeInTemplate
        ? "Template includes the standard compliance footer with unsubscribe."
        : "Footer could not be resolved — pick a built-in template or import HTML with {{content}}.",
    },
    {
      id: "from",
      label: "Sender identity",
      status: input.fromEmail?.trim() ? "pass" : "warn",
      detail: input.fromEmail?.trim()
        ? `${input.fromName?.trim() ? `${input.fromName} · ` : ""}${input.fromEmail}`
        : "Set From email on Settings before sending.",
    },
    {
      id: "postal",
      label: "Physical postal address",
      status: compliance?.postalAddress?.trim() ? "pass" : "warn",
      detail: compliance?.postalAddress?.trim()
        ? undefined
        : "CAN-SPAM requires a physical address in the footer — set in Compliance sender.",
    },
    {
      id: "org",
      label: "Organization name",
      status: compliance?.organizationName?.trim() ? "pass" : "warn",
      detail: compliance?.organizationName?.trim()
        ? undefined
        : "Recommended for marketing disclosure — set in Compliance sender.",
    },
    {
      id: "images",
      label: "Inline images",
      status: /data:image\//i.test(input.bodyMarkdown) ? "warn" : "pass",
      detail: /data:image\//i.test(input.bodyMarkdown)
        ? "Base64 images are stripped at send time — use uploaded assets instead."
        : "No Base64 data URIs detected in markdown.",
    },
  ];

  if (input.templateVariablesSchema?.fields.length) {
    const missingTabHint = (() => {
      if (!missingVars.length) return "";
      const allLogoFooter = missingVars.every(isLogoFooterTemplateVariableField);
      const anyLogoFooter = missingVars.some(isLogoFooterTemplateVariableField);
      if (allLogoFooter) return "Logo & Footer tab";
      if (anyLogoFooter) return "Logo & Footer or Variables tab";
      return "Variables tab";
    })();
    checks.splice(1, 0, {
      id: "template-vars",
      label: "Template variables",
      status: missingVars.length ? "fail" : "pass",
      detail: missingVars.length
        ? `Fill required fields: ${missingVars.map((f) => f.label).join(", ")} (${missingTabHint}).`
        : "Required layout variables are set.",
    });
  }

  return checks;
}

export function preflightStatusLabel(checks: PreflightCheck[]): string {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  if (failCount) {
    const parts = [`${failCount} block${failCount === 1 ? "" : "s"}`];
    if (warnCount) parts.push(`${warnCount} warn${warnCount === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }
  if (warnCount) return `${warnCount} warn${warnCount === 1 ? "" : "s"}`;
  return "Ready";
}
