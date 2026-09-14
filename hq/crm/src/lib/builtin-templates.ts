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
};

const FOOTER = `
    <tr>
      <td style="padding:24px 32px;text-align:center;font-size:12px;color:#94a3b8;">
        <a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a>
      </td>
    </tr>`;

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: PLAIN_TEXT_TEMPLATE_ID,
    name: "Plain text",
    htmlSource: `{{content}}

---
Unsubscribe: {{unsubscribe_url}}`,
  },
  {
    id: "tpl-minimal",
    name: "Minimal",
    htmlSource: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:32px;font-family:sans-serif;color:#0f172a;font-size:15px;line-height:1.6;">
        {{content}}
      </td></tr>${FOOTER}
    </table>
  </td></tr>
</table>`,
  },
  {
    id: "tpl-header-image",
    name: "Header image",
    htmlSource: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#0f172a;height:12px;"></td></tr>
      <tr><td style="padding:32px;font-family:sans-serif;color:#0f172a;font-size:15px;line-height:1.6;">
        {{content}}
      </td></tr>${FOOTER}
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
      </td></tr>${FOOTER}
    </table>
  </td></tr>
</table>`,
  },
];
