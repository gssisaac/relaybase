import type { BlockNoteEditor } from "@blocknote/core";

import {
  emailButtonMarkerHtml,
  emailButtonPropsFromBlockRecord,
  emailButtonPropsFromMarkerHtml,
  isEmailButtonBlock,
  isEmailButtonMarkerHtml,
  type EmailButtonProps,
} from "./email-button-html";
import {
  encodeEmptyParagraphsForParse,
  restoreEmptyParagraphBlocks,
} from "./empty-paragraph-markdown";
import { promotePageMediaBlocks } from "./media-markdown";

const EMAIL_BUTTON_MARKER_SPLIT =
  /(<div\b[^>]*\bdata-rb-email-button\b[^>]*>\s*<\/div>)/gi;

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

function emailButtonBlockFromProps(props: EmailButtonProps): Record<string, unknown> {
  return {
    type: "emailButton",
    props: {
      text: props.text,
      linkUrl: props.url,
      variant: props.variant,
      alignment: props.alignment,
    },
    children: [],
  };
}

function promoteEmailButtonBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const next = { ...(block as Record<string, unknown>) };
  if (Array.isArray(next.children)) {
    next.children = next.children.map(promoteEmailButtonBlock);
  }

  if (isEmailButtonBlock(next)) return next;

  if (next.type === "paragraph" && Array.isArray(next.content)) {
    const text = inlinePlainText(next.content).trim();
    if (isEmailButtonMarkerHtml(text)) {
      const props = emailButtonPropsFromMarkerHtml(text);
      if (props) return emailButtonBlockFromProps(props);
    }
  }

  return next;
}

/** Restore email button blocks after markdown parse (marker div lines). */
export function promoteEmailButtonBlocks<T>(blocks: T[]): T[] {
  return blocks.map((block) => promoteEmailButtonBlock(block) as T);
}

export function serializeEmailButtonBlockMarkdown(block: unknown): string | null {
  if (!isEmailButtonBlock(block)) return null;
  return emailButtonMarkerHtml(
    emailButtonPropsFromBlockRecord(block.props),
  );
}

function markdownContainsEmailButtonMarker(markdown: string): boolean {
  return /\bdata-rb-email-button\b/i.test(markdown);
}

/**
 * Parse markdown that may contain raw email-button marker divs interleaved with
 * normal markdown (BlockNote's markdown parser drops unknown HTML blocks).
 */
export async function parseMarkdownToEditorBlocks(
  editor: BlockNoteEditor<any, any, any>,
  markdown: string,
  linkifyParsedBlocks: (blocks: unknown[]) => unknown[],
): Promise<unknown[]> {
  const encoded = encodeEmptyParagraphsForParse(markdown);

  if (!markdownContainsEmailButtonMarker(encoded)) {
    return restoreEmptyParagraphBlocks(
      promoteEmailButtonBlocks(
        promotePageMediaBlocks(linkifyParsedBlocks(await editor.tryParseMarkdownToBlocks(encoded))),
      ),
    );
  }

  const segments = encoded.split(EMAIL_BUTTON_MARKER_SPLIT);
  const blocks: unknown[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    if (isEmailButtonMarkerHtml(trimmed)) {
      const props = emailButtonPropsFromMarkerHtml(trimmed);
      if (props) blocks.push(emailButtonBlockFromProps(props));
      continue;
    }

    const parsed = promoteEmailButtonBlocks(
      promotePageMediaBlocks(linkifyParsedBlocks(await editor.tryParseMarkdownToBlocks(trimmed))),
    );
    blocks.push(...parsed);
  }

  const restored = restoreEmptyParagraphBlocks(blocks);
  return restored.length > 0 ? restored : [{ type: "paragraph", content: "" }];
}
