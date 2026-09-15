import type { TemplateVariablesSchema } from "./variable-schema";

/** Must match `COMPLIANCE_FOOTER_TAG` in broadcast-standard-footer.ts. */
const COMPLIANCE_FOOTER = "{{compliance_footer}}";

/** Authoring reference — parsed into `variablesSchema` at seed/migrate time. */
export const HEADER_TEMPLATE_VARIABLES_YAML = `fields:
  - key: header.organization_name
    type: text
    label: Organization name
    required: true
    defaultFrom: compliance.organizationName
  - key: header.logo
    type: image
    label: Logo
    description: Shown beside the organization name in the header row.
`;

export const HEADER_TEMPLATE_VARIABLES: TemplateVariablesSchema = {
  fields: [
    {
      key: "header.organization_name",
      type: "text",
      label: "Organization name",
      required: true,
      defaultFrom: "compliance.organizationName",
    },
    {
      key: "header.logo",
      type: "image",
      label: "Logo",
      description: "Shown beside the organization name in the header row.",
    },
  ],
};

/**
 * P0-6 "design" layer — pure visual wrappers around `{{content}}`. Content
 * (campaigns.bodyMarkdown) is authored separately; these never carry copy.
 */
export const PLAIN_TEXT_TEMPLATE_ID = "tpl-plain-text";

export function isPlainTextTemplate(templateId: string | null | undefined): boolean {
  return templateId === PLAIN_TEXT_TEMPLATE_ID;
}

export type BuiltinTemplate = {
  id: string;
  name: string;
  htmlSource: string;
  variablesSchema?: TemplateVariablesSchema | null;
};

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: PLAIN_TEXT_TEMPLATE_ID,
    name: "Plain text",
    htmlSource: `{{content}}

${COMPLIANCE_FOOTER}`,
  },
  {
    id: "tpl-minimal",
    name: "Minimal",
    htmlSource: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:32px;font-family:sans-serif;color:#0f172a;font-size:15px;line-height:1.6;">
        {{content}}
      </td></tr>
      ${COMPLIANCE_FOOTER}
    </table>
  </td></tr>
</table>`,
  },
  {
    id: "tpl-header",
    name: "Header",
    variablesSchema: HEADER_TEMPLATE_VARIABLES,
    htmlSource: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:20px 32px;border-bottom:1px solid #e2e8f0;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td data-crm-header-logo="1" style="vertical-align:middle;padding-right:12px;line-height:0;font-size:0;">{{vars.header.logo}}</td>
            <td style="vertical-align:middle;font-family:sans-serif;font-size:18px;font-weight:600;color:#0f172a;line-height:1.3;">
              {{vars.header.organization_name}}
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:32px;font-family:sans-serif;color:#0f172a;font-size:15px;line-height:1.6;">
        {{content}}
      </td></tr>
      ${COMPLIANCE_FOOTER}
    </table>
  </td></tr>
</table>`,
  },
  {
    id: "tpl-card",
    name: "Card",
    htmlSource: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e2e8f0;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;">
      <tr><td style="padding:32px;font-family:sans-serif;color:#0f172a;font-size:15px;line-height:1.6;">
        {{content}}
      </td></tr>
      ${COMPLIANCE_FOOTER}
    </table>
  </td></tr>
</table>`,
  },
];
