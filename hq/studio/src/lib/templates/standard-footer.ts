/** Must match `PLAIN_TEXT_TEMPLATE_ID` in builtin-templates.ts. */
const PLAIN_TEXT_TEMPLATE_ID = "tpl-plain-text";

/** Legacy placeholder — prefer embedding footer HTML with compliance merge tags in template source. */
export const COMPLIANCE_FOOTER_TAG = "{{compliance_footer}}";

const FOOTER_CELL_STYLE =
  "padding:28px 32px;text-align:center;font-size:12px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;";

/** Table row footer for built-in HTML templates (inside a nested `<table>`). */
export const STANDARD_COMPLIANCE_FOOTER_HTML_TR = `
    <tr>
      <td style="${FOOTER_CELL_STYLE}">
        <p style="margin:0 0 10px;">Sent by {{organization_name}}</p>
        <p style="margin:0 0 10px;white-space:pre-line;">{{postal_address}}</p>
        <p style="margin:0 0 14px;">{{compliance_contact_email}}</p>
        <p style="margin:0;">
          <a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
          from this type of email.
        </p>
      </td>
    </tr>`;

/** Appended when a custom HTML template has no footer slot. */
export const STANDARD_COMPLIANCE_FOOTER_HTML_APPEND = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="${FOOTER_CELL_STYLE}">
      <p style="margin:0 0 10px;">Sent by {{organization_name}}</p>
      <p style="margin:0 0 10px;white-space:pre-line;">{{postal_address}}</p>
      <p style="margin:0 0 14px;">{{compliance_contact_email}}</p>
      <p style="margin:0;">
        <a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
        from this type of email.
      </p>
    </td>
  </tr>
</table>`;

export const STANDARD_COMPLIANCE_FOOTER_PLAIN = `---
Sent by {{organization_name}}
{{postal_address}}
{{compliance_contact_email}}
Unsubscribe: {{unsubscribe_url}}`;

/** True when the template HTML already includes compliance merge tags (editable footer in source). */
export function templateHasEmbeddedComplianceFooter(templateHtml: string): boolean {
  if (templateHtml.includes(COMPLIANCE_FOOTER_TAG)) return true;
  return (
    templateHtml.includes("{{unsubscribe_url}}") &&
    templateHtml.includes("{{postal_address}}") &&
    (templateHtml.includes("{{organization_name}}") ||
      templateHtml.includes("{{compliance_contact_email}}"))
  );
}

/** Drop legacy unsubscribe-only rows so we do not duplicate the standard footer. */
export function stripIncompleteComplianceFooters(templateHtml: string): string {
  if (templateHtml.includes(COMPLIANCE_FOOTER_TAG)) return templateHtml;
  if (templateHasEmbeddedComplianceFooter(templateHtml)) return templateHtml;

  return templateHtml
    .replace(
      /<tr>\s*<td[^>]*>[\s\S]*?\{\{unsubscribe_url\}\}[\s\S]*?<\/td>\s*<\/tr>/gi,
      (row) => (row.includes("{{content}}") ? row : ""),
    )
    .replace(
      /<table[^>]*>[\s\S]*?\{\{unsubscribe_url\}\}[\s\S]*?<\/table>/gi,
      (block) => {
        if (block.includes("{{content}}")) return block;
        if (block.includes("{{organization_name}}")) return block;
        if (block.includes("{{compliance_contact_email}}")) return block;
        return "";
      },
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
  const cleaned = stripIncompleteComplianceFooters(templateHtml);
  const expanded = expandComplianceFooterPlaceholder(cleaned, plainText);
  if (templateHasEmbeddedComplianceFooter(expanded)) return expanded;
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
