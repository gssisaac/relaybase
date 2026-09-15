/** Must match `PLAIN_TEXT_TEMPLATE_ID` in builtin-templates.ts. */
const PLAIN_TEXT_TEMPLATE_ID = "tpl-plain-text";

/** Insert in templates; expanded to the standard footer block at preview/send time. */
export const COMPLIANCE_FOOTER_TAG = "{{compliance_footer}}";

/** Table row footer for built-in HTML templates (inside a nested `<table>`). */
export const STANDARD_COMPLIANCE_FOOTER_HTML_TR = `
    <tr>
      <td style="padding:24px 32px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.5;">
        {{organization_name}}<br />
        {{postal_address}}<br />
        {{compliance_contact_email}}<br />
        <a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a>
      </td>
    </tr>`;

/** Appended when a custom HTML template has no footer slot. */
export const STANDARD_COMPLIANCE_FOOTER_HTML_APPEND = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding:24px 32px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.5;">
      {{organization_name}}<br />
      {{postal_address}}<br />
      {{compliance_contact_email}}<br />
      <a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a>
    </td>
  </tr>
</table>`;

export const STANDARD_COMPLIANCE_FOOTER_PLAIN = `---
{{organization_name}}
{{postal_address}}
{{compliance_contact_email}}
Unsubscribe: {{unsubscribe_url}}`;

export function templateHasEmbeddedComplianceFooter(templateHtml: string): boolean {
  if (templateHtml.includes(COMPLIANCE_FOOTER_TAG)) return true;
  return (
    templateHtml.includes("{{unsubscribe_url}}") &&
    templateHtml.includes("{{organization_name}}") &&
    templateHtml.includes("{{postal_address}}")
  );
}

export function expandComplianceFooterPlaceholder(
  templateHtml: string,
  plainText: boolean,
): string {
  if (!templateHtml.includes(COMPLIANCE_FOOTER_TAG)) return templateHtml;
  const block = plainText ? STANDARD_COMPLIANCE_FOOTER_PLAIN : STANDARD_COMPLIANCE_FOOTER_HTML_TR;
  return templateHtml.replaceAll(COMPLIANCE_FOOTER_TAG, block);
}

export function ensureComplianceFooterInTemplate(
  templateHtml: string,
  plainText: boolean,
): string {
  const expanded = expandComplianceFooterPlaceholder(templateHtml, plainText);
  if (templateHasEmbeddedComplianceFooter(templateHtml)) return expanded;
  if (plainText) {
    return `${expanded.trimEnd()}\n\n${STANDARD_COMPLIANCE_FOOTER_PLAIN}`;
  }
  return `${expanded}${STANDARD_COMPLIANCE_FOOTER_HTML_APPEND}`;
}

export function prepareBroadcastTemplateHtml(
  templateHtml: string,
  templateId: string | null | undefined,
): string {
  return ensureComplianceFooterInTemplate(templateHtml, templateId === PLAIN_TEXT_TEMPLATE_ID);
}
