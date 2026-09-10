/**
 * Detects HTML email bodies that are structurally plain text — e.g. Gmail's
 * `<div dir="ltr">…</div>` wrapping around a typed reply — so they can be
 * rendered as text instead of inside a sandboxed iframe. Mail clients wrap
 * even trivial text bodies in HTML tags, which otherwise always trips the
 * "this is a web page" path in EmailHtmlFrame.
 *
 * The check is deliberately conservative: any image, table, media/interactive
 * element, background styling, unrecognized tag, or inline-attachment (cid:)
 * reference disqualifies the body, since those signal real visual design
 * rather than typed text.
 */

/** Tags a typed text message can plausibly contain — anything else disqualifies. */
const ALLOWED_TAGS = new Set([
  "html",
  "head",
  "body",
  "meta",
  "title",
  "div",
  "span",
  "p",
  "br",
  "hr",
  "wbr",
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "small",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "font",
]);

const BACKGROUND_STYLE_RE =
  /background(?:-color|-image)?\s*:\s*(?!(?:transparent|none)\b)[^;"']+/i;

const CID_REFERENCE_RE = /cid:/i;

function stripNonContentBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}

/**
 * True when `html` carries no signal of a designed layout — no images,
 * tables, media/interactive elements, background styling, or unrecognized
 * tags — so its visible content is equivalent to plain text.
 */
export function isPlainTextEmailHtml(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed) return false;

  const content = stripNonContentBlocks(trimmed);
  if (BACKGROUND_STYLE_RE.test(content)) return false;
  if (CID_REFERENCE_RE.test(content)) return false;

  const tags = content.match(/<\/?([a-z][a-z0-9-]*)/gi) ?? [];
  for (const tag of tags) {
    const name = tag.replace(/^<\/?/, "").toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return false;
  }

  return true;
}

/**
 * Extracts visible text from an HTML body already confirmed plain by
 * `isPlainTextEmailHtml`. Block-level closes become line breaks and list
 * items get a bullet, mirroring how a plain-text mail client would show it.
 */
export function extractPlainTextFromEmailHtml(html: string): string {
  return stripNonContentBlocks(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|div|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
