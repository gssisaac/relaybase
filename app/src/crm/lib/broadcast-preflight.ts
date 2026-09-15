import { prepareBroadcastTemplateHtml } from "@/crm/lib/broadcast-standard-footer";
import type { CrmAccountCompliance } from "@/lib/crm/api";

export type PreflightCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
};

export function runBroadcastPreflight(input: {
  subject: string;
  bodyMarkdown: string;
  templateHtml: string;
  templateId?: string | null;
  fromEmail: string | null;
  fromName: string | null;
  compliance: CrmAccountCompliance | null | undefined;
}): PreflightCheck[] {
  const preparedTemplate = prepareBroadcastTemplateHtml(
    input.templateHtml,
    input.templateId,
  );
  const combined = `${preparedTemplate}\n${input.bodyMarkdown}`;
  const hasUnsubscribeInTemplate =
    combined.includes("{{unsubscribe_url}}") || combined.includes("{{compliance_footer}}");
  const compliance = input.compliance;

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

  return checks;
}
