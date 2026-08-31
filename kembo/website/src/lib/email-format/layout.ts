import { BRAND, COLOR, FONT } from "./theme";
import type { EmailCard } from "./types";

export function renderEmailHtml(card: EmailCard): string {
  const paragraphs = card.paragraphs
    .map(
      (text) => `
        <tr>
          <td style="padding:0 0 14px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${COLOR.fg};">
            ${escapeHtml(text)}
          </td>
        </tr>`,
    )
    .join("");

  const action = card.action
    ? `
        <tr>
          <td style="padding:8px 0 4px 0;" align="left">
            <a href="${escapeAttr(card.action.href)}" target="_blank" rel="noopener noreferrer"
              style="display:inline-block;background:${COLOR.brand};color:${COLOR.white};font-family:${FONT};font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:14px 22px;border-radius:10px;">
              ${escapeHtml(card.action.label)}
            </a>
          </td>
        </tr>`
    : "";

  const fallback = card.fallbackHref
    ? `
        <tr>
          <td style="padding:18px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};">
            Or paste this link into your browser:
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.well};border:1px solid ${COLOR.border};border-radius:8px;">
              <tr>
                <td style="padding:10px 12px;font-family:${FONT};font-size:12px;line-height:1.45;word-break:break-all;">
                  <a href="${escapeAttr(card.fallbackHref)}" style="color:${COLOR.brand};text-decoration:underline;">${escapeHtml(card.fallbackHref)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : "";

  const footnote = card.footnote
    ? `
        <tr>
          <td style="padding:20px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};">
            ${escapeHtml(card.footnote)}
          </td>
        </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(card.title)}</title>
  <!--[if mso]>
  <style type="text/css">
    table, td, div, p, a, span { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${COLOR.page};font-family:${FONT};color:${COLOR.fg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(card.preview)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.page};margin:0;padding:0;font-family:${FONT};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:16px;">
          <tr>
            <td style="padding:28px 32px 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding:0 10px 0 0;">
                    <img src="${BRAND.icon}" width="40" height="40" alt="${escapeAttr(BRAND.name)}" style="display:block;width:40px;height:40px;border:0;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;font-family:${FONT};font-size:18px;font-weight:600;letter-spacing:-0.02em;color:${COLOR.fg};">
                    ${escapeHtml(BRAND.name)}
                  </td>
                  <td style="vertical-align:middle;padding:0 0 0 10px;">
                    <span style="display:inline-block;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.02em;color:${COLOR.badgeFg};background:${COLOR.badgeBg};border-radius:999px;padding:3px 8px;">
                      Beta
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px 32px;font-family:${FONT};font-size:22px;font-weight:700;line-height:1.25;letter-spacing:-0.03em;color:${COLOR.fg};">
              ${escapeHtml(card.title)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${paragraphs}
                ${action}
                ${fallback}
                ${footnote}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px 32px;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLOR.muted};border-top:1px solid ${COLOR.border};">
              <div style="padding-top:18px;">
                ${escapeHtml(BRAND.tagline)}
                <br />
                <a href="${BRAND.site}" style="color:${COLOR.brand};text-decoration:none;font-family:${FONT};">relaybase.xyz</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
