/** Keep in sync with hq/studio/src/lib/render/email-button-html.ts */

export type EmailButtonVariant = "primary" | "outline";
export type EmailButtonAlign = "left" | "center" | "right" | "full";

export type EmailButtonProps = {
  text: string;
  url: string;
  variant: EmailButtonVariant;
  alignment: EmailButtonAlign;
};

const VARIANTS: EmailButtonVariant[] = ["primary", "outline"];
const ALIGNS: EmailButtonAlign[] = ["left", "center", "right", "full"];

export function normalizeEmailButtonVariant(value: string | null | undefined): EmailButtonVariant {
  return VARIANTS.includes(value as EmailButtonVariant) ? (value as EmailButtonVariant) : "primary";
}

export function normalizeEmailButtonAlign(value: string | null | undefined): EmailButtonAlign {
  return ALIGNS.includes(value as EmailButtonAlign) ? (value as EmailButtonAlign) : "center";
}

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Stored in newsletter markdown; converted to bulletproof HTML at preview/send time. */
export function emailButtonMarkerHtml(props: EmailButtonProps): string {
  const text = props.text.trim() || "Button";
  const url = props.url.trim() || "#";
  return `<div data-rb-email-button="" data-text="${escapeHtmlAttr(text)}" data-href="${escapeHtmlAttr(url)}" data-variant="${normalizeEmailButtonVariant(props.variant)}" data-align="${normalizeEmailButtonAlign(props.alignment)}"></div>`;
}

const EMAIL_BUTTON_MARKER_RE =
  /<div\b[^>]*\bdata-rb-email-button\b[^>]*>\s*<\/div>/gi;

function readDataAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`\\bdata-${name}\\s*=\\s*"([^"]*)"`, "i");
  const m = attrs.match(re);
  return m?.[1] ?? null;
}

function parseMarkerTag(tag: string): EmailButtonProps | null {
  if (!/\bdata-rb-email-button\b/i.test(tag)) return null;
  const attrsMatch = tag.match(/^<div\b([^>]*)>/i);
  const attrs = attrsMatch?.[1] ?? "";
  return {
    text: readDataAttr(attrs, "text")?.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&amp;", "&") ?? "Button",
    url: readDataAttr(attrs, "href")?.replaceAll("&quot;", '"').replaceAll("&amp;", "&") ?? "#",
    variant: normalizeEmailButtonVariant(readDataAttr(attrs, "variant")),
    alignment: normalizeEmailButtonAlign(readDataAttr(attrs, "align")),
  };
}

export function isEmailButtonMarkerHtml(html: string): boolean {
  return /\bdata-rb-email-button\b/i.test(html.trim());
}

export function emailButtonPropsFromMarkerHtml(html: string): EmailButtonProps | null {
  const trimmed = html.trim();
  const tagMatch = trimmed.match(/^<div\b[^>]*>\s*<\/div>$/i);
  if (!tagMatch) return null;
  return parseMarkerTag(trimmed);
}

function tableMargin(alignment: EmailButtonAlign): string {
  if (alignment === "left") return "16px 0";
  if (alignment === "right") return "16px 0 16px auto";
  if (alignment === "full") return "16px 0";
  return "16px auto";
}

function tableAlignAttr(alignment: EmailButtonAlign): string {
  if (alignment === "left") return "left";
  if (alignment === "right") return "right";
  return "center";
}

/** BlockNote editor row — full-width flex so justify-* matches button alignment. */
export function emailButtonEditorRowClassName(alignment: EmailButtonAlign): string {
  const normalized = normalizeEmailButtonAlign(alignment);
  if (normalized === "left") return "flex w-full max-w-full justify-start";
  if (normalized === "right") return "flex w-full max-w-full justify-end";
  if (normalized === "full") return "flex w-full max-w-full justify-stretch";
  return "flex w-full max-w-full justify-center";
}

function wrapEmailButtonRow(alignment: EmailButtonAlign, tableHtml: string): string {
  if (alignment === "full") {
    return `<div data-rb-email-button-row="full" style="width:100%;max-width:100%;margin:12px 0;">${tableHtml}</div>`;
  }
  const textAlign =
    alignment === "left" ? "left" : alignment === "right" ? "right" : "center";
  return `<div data-rb-email-button-row="" style="width:100%;max-width:100%;margin:12px 0;text-align:${textAlign};">${tableHtml}</div>`;
}

function buttonStyles(variant: EmailButtonVariant, alignment: EmailButtonAlign): {
  tdBg: string;
  tdBorder: string;
  linkColor: string;
  linkBg: string;
  width: string;
} {
  if (variant === "outline") {
    return {
      tdBg: "#ffffff",
      tdBorder: "1px solid #18181b",
      linkColor: "#18181b",
      linkBg: "#ffffff",
      width: alignment === "full" ? "100%" : "auto",
    };
  }
  return {
    tdBg: "#18181b",
    tdBorder: "1px solid #18181b",
    linkColor: "#ffffff",
    linkBg: "#18181b",
    width: alignment === "full" ? "100%" : "auto",
  };
}

export function renderBulletproofEmailButton(props: EmailButtonProps): string {
  const text = escapeHtmlText(props.text.trim() || "Button");
  const url = escapeHtmlAttr(props.url.trim() || "#");
  const alignment = normalizeEmailButtonAlign(props.alignment);
  const variant = normalizeEmailButtonVariant(props.variant);
  const { tdBg, tdBorder, linkColor, linkBg, width } = buttonStyles(variant, alignment);
  const tableAlign = tableAlignAttr(alignment);
  const padding = alignment === "full" ? "14px 20px" : "12px 28px";
  const display = alignment === "full" ? "block" : "inline-block";
  const tableDisplay = alignment === "full" ? "table" : "inline-table";

  const table = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${tableAlign}" style="display:${tableDisplay};margin:${tableMargin(alignment)};border-collapse:separate;${alignment === "full" ? "width:100%;" : ""}">
  <tr>
    <td align="center" bgcolor="${tdBg}" style="border-radius:8px;background-color:${tdBg};border:${tdBorder};width:${width};">
      <a href="${url}" target="_blank" style="display:${display};padding:${padding};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${linkColor};background-color:${linkBg};text-decoration:none;border-radius:8px;line-height:1.2;text-align:center;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;

  return wrapEmailButtonRow(alignment, table);
}

/** Replace stored marker divs with bulletproof button tables (preview + send). */
export function transformEmailButtonMarkersToBulletproof(html: string): string {
  return html.replace(EMAIL_BUTTON_MARKER_RE, (tag) => {
    const props = parseMarkerTag(tag);
    if (!props) return tag;
    return renderBulletproofEmailButton(props);
  });
}

export function emailButtonPropsFromBlockRecord(
  props: Record<string, unknown>,
): EmailButtonProps {
  const legacyUrl = props.url;
  const linkUrl = props.linkUrl;
  const url =
    typeof linkUrl === "string"
      ? linkUrl
      : typeof legacyUrl === "string"
        ? legacyUrl
        : "https://";
  return {
    text: typeof props.text === "string" ? props.text : "Button",
    url,
    variant: normalizeEmailButtonVariant(
      typeof props.variant === "string" ? props.variant : undefined,
    ),
    alignment: normalizeEmailButtonAlign(
      typeof props.alignment === "string" ? props.alignment : undefined,
    ),
  };
}

export function isEmailButtonBlock(block: unknown): block is {
  type: "emailButton";
  props: Record<string, unknown>;
} {
  if (!block || typeof block !== "object") return false;
  const b = block as { type?: string; props?: unknown };
  return b.type === "emailButton" && !!b.props && typeof b.props === "object";
}
