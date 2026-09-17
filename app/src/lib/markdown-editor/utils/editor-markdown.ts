import type { BlockNoteEditor } from "@blocknote/core";

import { serializeEmailButtonBlockMarkdown } from "./email-button-markdown";
import { transformEmailButtonMarkersToBulletproof } from "./email-button-html";
import { serializePageMediaMarkdown } from "./media-markdown";

/** Round-trips as an empty paragraph (BlockNote drops truly empty blocks in lossy MD). */
export const EMPTY_PARAGRAPH_MD = "\u00a0";

function inlinePlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => {
      if (node && typeof node === "object" && "text" in node) {
        return String((node as { text: string }).text);
      }
      return "";
    })
    .join("");
}

export function isEmptyParagraphBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const b = block as { type?: string; content?: unknown };
  if (b.type !== "paragraph") return false;
  const text = inlinePlainText(b.content);
  const trimmed = text.trim();
  if (trimmed === "") return true;
  return trimmed === "\u00a0" || trimmed === "&nbsp;";
}

/** Serialize top-level blocks so intentional blank lines survive save/reload. */
export function serializeEditorMarkdown(editor: BlockNoteEditor): string {
  const chunks: string[] = [];
  for (const block of editor.document) {
    if (isEmptyParagraphBlock(block)) {
      chunks.push(EMPTY_PARAGRAPH_MD);
      continue;
    }
    const buttonMd = serializeEmailButtonBlockMarkdown(block);
    if (buttonMd) {
      chunks.push(buttonMd);
      continue;
    }
    const piece = editor.blocksToMarkdownLossy([block as never]).trim();
    if (piece) chunks.push(piece);
  }
  let markdown = chunks.join("\n\n");
  if (chunks.length > 0) markdown += "\n";
  return serializePageMediaMarkdown(markdown);
}

/** Gmail reading-pane default for unstyled anchors. */
export const GMAIL_LINK_STYLE = "color:#1155cc;text-decoration:underline;";

/**
 * Paint content links the way Gmail actually shows them.
 * Leaves anchors that already set `color` alone (footer unsubscribe, buttons).
 */
export function applyGmailContentLinkStyles(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const styleMatch = attrs.match(/\bstyle\s*=\s*"([^"]*)"/i);
    if (styleMatch && /(?:^|;)\s*color\s*:/i.test(styleMatch[1])) {
      return full;
    }
    if (styleMatch) {
      const merged = styleMatch[1].trim().replace(/;\s*$/, "");
      const next = `${merged};${GMAIL_LINK_STYLE}`;
      return `<a${attrs.replace(/\bstyle\s*=\s*"[^"]*"/i, `style="${next}"`)}>`;
    }
    return `<a${attrs} style="${GMAIL_LINK_STYLE}">`;
  });
}

/** Make empty paragraphs visible in email-style HTML previews. */
export function enhancePreviewHtml(html: string): string {
  return applyGmailContentLinkStyles(
    transformEmailButtonMarkersToBulletproof(
      html
        .replace(/<p>\s*<\/p>/gi, "<p>&nbsp;</p>")
        .replace(/<p><br\s*\/?><\/p>/gi, "<p>&nbsp;</p>"),
    ),
  );
}
