/** Round-trips as an empty paragraph (BlockNote drops truly empty blocks in lossy MD). */
export const EMPTY_PARAGRAPH_MD = "\u00a0";

/**
 * Word joiner — not stripped by `String#trim()`, so BlockNote's markdown
 * tokenizer (`line.trim() === ""`) will keep it as a paragraph. NBSP cannot
 * be used here: JS trim treats `\u00a0` as whitespace and the parser skips it.
 */
export const EMPTY_PARAGRAPH_PARSE_TOKEN = "\u2060";

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

function compactMarkdownLine(line: string): string {
  return line.replace(/[ \t]/g, "");
}

export function isEmptyParagraphMarkdownLine(line: string): boolean {
  const compact = compactMarkdownLine(line);
  return (
    compact === "\u00a0" ||
    compact === "&nbsp;" ||
    compact === EMPTY_PARAGRAPH_MD ||
    compact === EMPTY_PARAGRAPH_PARSE_TOKEN
  );
}

export function isEmptyParagraphBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const b = block as { type?: string; content?: unknown };
  if (b.type !== "paragraph") return false;
  const text = inlinePlainText(b.content);
  const trimmed = text.trim();
  if (trimmed === "") return true;
  return (
    trimmed === "\u00a0" ||
    trimmed === "&nbsp;" ||
    trimmed === EMPTY_PARAGRAPH_PARSE_TOKEN
  );
}

function isFenceLine(line: string): boolean {
  return /^ {0,3}(`{3,}|~{3,})/.test(line);
}

/**
 * BlockNote skips lines where `trim()` is empty. Encode persisted empty
 * paragraphs so they survive `tryParseMarkdownToBlocks`.
 */
export function encodeEmptyParagraphsForParse(markdown: string): string {
  const lines = markdown.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (isFenceLine(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return isEmptyParagraphMarkdownLine(line) ? EMPTY_PARAGRAPH_PARSE_TOKEN : line;
    })
    .join("\n");
}

/** Turn parse-token / nbsp paragraphs back into truly empty editor blocks. */
export function restoreEmptyParagraphBlocks<T>(blocks: T[]): T[] {
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const next = { ...(block as Record<string, unknown>) };
    if (Array.isArray(next.children)) {
      next.children = restoreEmptyParagraphBlocks(next.children);
    }
    if (isEmptyParagraphBlock(next)) {
      next.content = [];
    }
    return next as T;
  });
}
