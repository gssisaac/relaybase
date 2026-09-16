/** Must match `public/templates/dark-obsidian/meta.yaml`. */
export const DARK_OBSIDIAN_TEMPLATE_ID = "tpl-dark-obsidian";

export function isDarkObsidianLayout(layoutId: string | null | undefined): boolean {
  return layoutId === DARK_OBSIDIAN_TEMPLATE_ID;
}

const DARK_BODY_COLOR = "#e4e4e7";

export const DEFAULT_CONTENT_PARAGRAPH_STYLE =
  "margin:0 0 12px;font-family:sans-serif;font-size:15px;line-height:1.5;color:#334155";

export const DARK_OBSIDIAN_CONTENT_PARAGRAPH_STYLE = `margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:${DARK_BODY_COLOR}`;

export function layoutContentParagraphStyle(layoutId: string | null | undefined): string {
  return isDarkObsidianLayout(layoutId)
    ? DARK_OBSIDIAN_CONTENT_PARAGRAPH_STYLE
    : DEFAULT_CONTENT_PARAGRAPH_STYLE;
}

/** Ensures markdown body fragments inherit light text on dark shells (email clients). */
export function wrapLayoutBodyHtml(
  contentHtml: string,
  layoutId: string | null | undefined,
): string {
  if (!isDarkObsidianLayout(layoutId)) return contentHtml;
  const trimmed = contentHtml.trim();
  if (!trimmed) return contentHtml;
  return `<div style="color:${DARK_BODY_COLOR};font-size:15px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${contentHtml}</div>`;
}
