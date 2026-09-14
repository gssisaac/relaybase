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
  fromEmail: string | null;
  fromName: string | null;
  compliance: CrmAccountCompliance | null | undefined;
}): PreflightCheck[] {
  const combined = `${input.templateHtml}\n${input.bodyMarkdown}`;
  const hasUnsubscribeInTemplate = combined.includes("{{unsubscribe_url}}");
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
        ? "Template or body includes {{unsubscribe_url}} (footer on built-in templates)."
        : "Add {{unsubscribe_url}} or use a built-in template with footer.",
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
        : "CAN-SPAM requires a physical address in the footer — set in Settings → Compliance.",
    },
    {
      id: "org",
      label: "Organization name",
      status: compliance?.organizationName?.trim() ? "pass" : "warn",
      detail: compliance?.organizationName?.trim()
        ? undefined
        : "Recommended for marketing disclosure — set in Settings → Compliance.",
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
