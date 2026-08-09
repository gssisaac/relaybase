const QUOTE_HEADER_RE = /^On .+ wrote:\s*$/;
/** Gmail often wraps: `On … <email>\nwrote:` */
const QUOTE_HEADER_TWO_LINE_RE = /^On .+\nwrote:\s*$/;
const QUOTED_LINE_RE = /^>/;

const GMAIL_BLOCKQUOTE_STYLE =
  "margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex";

type FlatLine =
  | { kind: "header"; depth: number; text: string }
  | { kind: "body"; depth: number; text: string }
  | { kind: "blank"; depth: number };

type Seg =
  | { type: "text"; text: string }
  | { type: "blank" }
  | { type: "quote"; children: Seg[] };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isQuoteHeaderAt(lines: string[], i: number): number {
  const line = lines[i]!;
  if (QUOTE_HEADER_RE.test(line)) return 1;
  if (
    i + 1 < lines.length &&
    QUOTE_HEADER_TWO_LINE_RE.test(`${line}\n${lines[i + 1]!}`)
  ) {
    return 2;
  }
  return 0;
}

function replyBeforeQuoteHeader(lines: string[], headerAt: number): string {
  const before = lines.slice(0, headerAt);
  if (before.length > 0 && before[before.length - 1] === "") {
    before.pop();
  }
  return before.join("\n");
}

/** Same boundary rules as `splitQuotedBody` (kept local for node:test). */
function splitReplyAndQuote(body: string): {
  reply: string;
  quote: string | null;
} {
  const normalized = body.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const headerLines = isQuoteHeaderAt(lines, i);
    if (!headerLines) continue;
    const reply = replyBeforeQuoteHeader(lines, i);
    const quote = lines.slice(i).join("\n");
    return { reply, quote: quote.length ? quote : null };
  }

  let blankAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "") {
      blankAt = i;
      continue;
    }
    if (blankAt < 0) continue;
    if (!QUOTED_LINE_RE.test(lines[i]!)) {
      blankAt = -1;
      continue;
    }
    let allQuoted = true;
    for (let j = i; j < lines.length; j++) {
      const line = lines[j]!;
      if (line === "" || QUOTED_LINE_RE.test(line)) continue;
      allQuoted = false;
      break;
    }
    if (!allQuoted) {
      blankAt = -1;
      continue;
    }
    const reply = lines.slice(0, blankAt).join("\n");
    const quote = lines.slice(blankAt + 1).join("\n");
    return { reply, quote: quote.length ? quote : null };
  }

  return { reply: normalized, quote: null };
}

function parseFlatLines(quote: string): FlatLine[] {
  const lines = quote.replace(/\r\n/g, "\n").split("\n");
  const flat: FlatLine[] = lines.map((line) => {
    if (line === "") return { kind: "blank" as const, depth: 0 };
    let depth = 0;
    let rest = line;
    while (rest.startsWith(">")) {
      depth += 1;
      rest = rest.slice(1);
      if (rest.startsWith(" ")) rest = rest.slice(1);
    }
    if (QUOTE_HEADER_RE.test(rest)) {
      return { kind: "header" as const, depth, text: rest };
    }
    return { kind: "body" as const, depth, text: rest };
  });

  for (let i = 0; i < flat.length; i++) {
    const line = flat[i]!;
    if (line.kind !== "blank") continue;
    let prev = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (flat[j]!.kind !== "blank") {
        prev = flat[j]!.depth;
        break;
      }
    }
    let next = 0;
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j]!.kind !== "blank") {
        next = flat[j]!.depth;
        break;
      }
    }
    line.depth = Math.min(prev, next) || prev || next;
  }

  return flat;
}

function nestSegments(items: FlatLine[], minDepth: number): Seg[] {
  const out: Seg[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i]!;
    if (item.depth <= minDepth) {
      if (item.kind === "blank") out.push({ type: "blank" });
      else out.push({ type: "text", text: item.text });
      i += 1;
      continue;
    }
    const start = i;
    while (i < items.length && items[i]!.depth > minDepth) i += 1;
    out.push({
      type: "quote",
      children: nestSegments(items.slice(start, i), minDepth + 1),
    });
  }
  return out;
}

function renderSegments(segments: Seg[]): string {
  let html = "";
  for (const seg of segments) {
    if (seg.type === "blank") {
      html += "<br>";
      continue;
    }
    if (seg.type === "text") {
      html += `${escapeHtml(seg.text)}<br>`;
      continue;
    }
    html += `<blockquote class="gmail_quote" style="${GMAIL_BLOCKQUOTE_STYLE}">`;
    html += renderSegments(seg.children);
    html += "</blockquote>";
  }
  return html;
}

function replyBodyToHtml(reply: string): string {
  const normalized = reply.replace(/\r\n/g, "\n");
  if (!normalized) return "";
  const lines = normalized.split("\n");
  const inner = lines.map((line) => escapeHtml(line)).join("<br>");
  return `<div dir="ltr">${inner}</div>`;
}

function quoteToHtml(quote: string): string {
  const segments = nestSegments(parseFlatLines(quote), 0);
  return `<div class="gmail_quote">${renderSegments(segments)}</div>`;
}

/**
 * Convert outbound plain-text (including `>` quote history) into Gmail-friendly
 * HTML with nested `<blockquote class="gmail_quote">` so clients render quote bars.
 */
export function plainTextToEmailHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const { reply, quote } = splitReplyAndQuote(normalized);
  const parts: string[] = [];
  const replyHtml = replyBodyToHtml(reply);
  if (replyHtml) parts.push(replyHtml);
  if (quote) {
    if (parts.length) parts.push("<br>");
    parts.push(quoteToHtml(quote));
  }
  if (parts.length === 0) {
    return '<div dir="ltr"></div>';
  }
  return parts.join("");
}
