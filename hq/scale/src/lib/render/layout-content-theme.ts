/** Must match `public/templates/dark-obsidian/meta.yaml`. */
export const DARK_OBSIDIAN_TEMPLATE_ID = "tpl-dark-obsidian";

export function isDarkObsidianLayout(layoutId: string | null | undefined): boolean {
  return layoutId === DARK_OBSIDIAN_TEMPLATE_ID;
}

const DARK_BODY_COLOR = "#e4e4e7";

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
