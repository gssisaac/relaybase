const QUOTE_HEADER_RE = /^On .+ wrote:\s*$/;
/** Gmail often wraps: `On … <email>\nwrote:` */
const QUOTE_HEADER_TWO_LINE_RE = /^On .+\nwrote:\s*$/;
const QUOTED_LINE_RE = /^>/;
/**
 * Inline (not line-anchored) `On … wrote:` — catches headers that survived
 * whitespace-collapse (e.g. `bodyPreview`) or ran on past `wrote:` on the
 * same line. Used only as a fallback when the strict line-anchored pass fails.
 */
const INLINE_QUOTE_HEADER_RE = /On [^\n]+?\bwrote:/;

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

/**
 * `joinQuotedBody` always inserts exactly one blank line (`\n\n`) before the
 * quote. When splitting, drop that separator empty line only — keep spaces and
 * user-typed trailing newlines so the compose textarea round-trip is lossless.
 */
function replyBeforeQuoteHeader(lines: string[], headerAt: number): string {
  const before = lines.slice(0, headerAt);
  if (before.length > 0 && before[before.length - 1] === "") {
    before.pop();
  }
  return before.join("\n");
}

/**
 * Split a compose/message body into the new reply and trailing quoted history.
 * Primary boundary: first `On … wrote:` header (one or two lines).
 * Fallback: first blank-line-separated block that is entirely `>`-prefixed.
 */
export function splitQuotedBody(body: string): {
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

  // Fallback: inline `On … wrote:` not on its own line (whitespace-collapsed
  // `bodyPreview`, or a header that ran on past `wrote:`). Only accept when the
  // remainder carries `>` quote markers so plain prose is not mis-split.
  const inlineMatch = INLINE_QUOTE_HEADER_RE.exec(normalized);
  if (inlineMatch && inlineMatch.index != null && inlineMatch.index > 0) {
    const tail = normalized.slice(inlineMatch.index);
    if (/>/.test(tail)) {
      const reply = normalized.slice(0, inlineMatch.index).replace(/\s+$/g, "");
      const quote = tail;
      if (reply.trim() || quote.length) {
        return { reply, quote: quote.length ? quote : null };
      }
    }
  }

  // Fallback: blank line then a run of quoted lines through EOF.
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
    // Confirm remainder is quote-shaped (quoted or blank).
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

/** Rejoin reply + wire-format quote for draft/send storage. */
export function joinQuotedBody(reply: string, quote: string | null): string {
  if (!quote) return reply;
  // Preserve reply as typed (spaces + trailing newlines); separator is always `\n\n`.
  return reply.length > 0 ? `${reply}\n\n${quote}` : `\n\n${quote}`;
}

const HTML_QUOTE_START_RE =
  /<div[^>]*class=(["'])[^"']*\b(?:gmail_quote|yahoo_quoted|protonmail_quote|moz-cite-prefix)[^"']*\1[^>]*>|<blockquote\b[^>]*>/i;

/**
 * Gmail / Apple / Outlook forward wrappers. Dashes required so prose like
 * "see the forwarded message" does not match.
 */
const FORWARDED_MESSAGE_RE =
  /-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message\s*:|-{5,}\s*Original Message\s*-{5,}/i;

function isVisuallyEmptyHtml(html: string): boolean {
  return (
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "")
      .replace(
        /<\/?(?:div|span|p|html|body|font|center|table|tbody|thead|tr|td|th|u|i|b|strong|em|a)[^>]*>/gi,
        "",
      )
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, "") === ""
  );
}

/**
 * True when the *first* quote block is a forward, not a reply citation.
 * Only the leading `gmail_attr` (or the first visible words) is checked so a
 * reply to a forwarded message still trims.
 */
function quoteLooksLikeForward(quoteHtml: string): boolean {
  const attr =
    /<div[^>]*class=(["'])[^"']*\bgmail_attr\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/i.exec(
      quoteHtml,
    );
  if (attr?.[2]) return FORWARDED_MESSAGE_RE.test(attr[2]);
  const visible = quoteHtml
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return FORWARDED_MESSAGE_RE.test(visible);
}

/** Forward header appears before any `On … wrote:` reply citation. */
function textLooksLikeForward(text: string): boolean {
  const cut = /(?:^|\n)On .+ wrote:/m.exec(text);
  const head =
    cut && cut.index != null ? text.slice(0, cut.index) : text;
  return FORWARDED_MESSAGE_RE.test(head);
}

function keepFullHtml(
  replyHtml: string,
  quoteHtml: string,
): { replyHtml: string; quoteHtml: string | null } | null {
  if (
    !replyHtml.trim() ||
    isVisuallyEmptyHtml(replyHtml) ||
    quoteLooksLikeForward(quoteHtml)
  ) {
    return null;
  }
  return {
    replyHtml,
    quoteHtml: quoteHtml.length ? quoteHtml : null,
  };
}

/**
 * Split HTML email body before common quoted-history containers
 * (Gmail / Yahoo / Proton / generic blockquote).
 *
 * Forwards wrap the *entire* original in `gmail_quote` / `<blockquote>`.
 * Those stay intact — they are the message, not nested reply history.
 */
export function splitQuotedHtml(html: string): {
  replyHtml: string;
  quoteHtml: string | null;
} {
  const match = HTML_QUOTE_START_RE.exec(html);
  if (!match || match.index == null || match.index === 0) {
    // Also cut on plain "On … wrote:" surviving inside HTML.
    const onWrote = /(?:^|>)\s*On .+? wrote:\s*(?:<br\s*\/?>|\n)/i.exec(html);
    if (onWrote && onWrote.index != null && onWrote.index > 0) {
      const at = onWrote[0]!.startsWith(">")
        ? onWrote.index + 1
        : onWrote.index;
      const replyHtml = html.slice(0, at).replace(/\s+$/g, "");
      const quoteHtml = html.slice(at);
      const kept = keepFullHtml(replyHtml, quoteHtml);
      if (kept) return kept;
    }
    return { replyHtml: html, quoteHtml: null };
  }
  const replyHtml = html.slice(0, match.index).replace(/\s+$/g, "");
  const quoteHtml = html.slice(match.index);
  return keepFullHtml(replyHtml, quoteHtml) ?? {
    replyHtml: html,
    quoteHtml: null,
  };
}

export type TrimmedMessageBody = {
  bodyText: string;
  bodyHtml?: string;
  /** Plain-text quote for optional ··· expander; null when nothing trimmed. */
  quoteText: string | null;
};

/**
 * For conversation stacks: keep only the new reply content and hide nested history.
 * Prefers plain-text split when a quote is found (HTML often duplicates it).
 *
 * Forwards are the message body — do not trim them, even when the forwarded
 * original itself contains `On … wrote:` history.
 */
export function trimQuotedHistoryForThread(input: {
  bodyText?: string | null;
  bodyPreview?: string | null;
  bodyHtml?: string | null;
}): TrimmedMessageBody {
  const rawText = (input.bodyText || input.bodyPreview || "").replace(
    /\r\n/g,
    "\n",
  );
  const html = input.bodyHtml?.trim();
  if (textLooksLikeForward(rawText) || (html && quoteLooksLikeForward(html))) {
    return {
      bodyText: rawText,
      bodyHtml: html || undefined,
      quoteText: null,
    };
  }

  const textSplit = splitQuotedBody(rawText);
  if (textSplit.quote) {
    return {
      bodyText: textSplit.reply,
      bodyHtml: undefined,
      quoteText: textSplit.quote,
    };
  }

  if (html) {
    const htmlSplit = splitQuotedHtml(html);
    if (htmlSplit.quoteHtml) {
      return {
        bodyText: textSplit.reply,
        bodyHtml: htmlSplit.replyHtml,
        quoteText: null,
      };
    }
    return {
      bodyText: textSplit.reply,
      bodyHtml: html,
      quoteText: null,
    };
  }

  return {
    bodyText: textSplit.reply,
    bodyHtml: undefined,
    quoteText: null,
  };
}

/**
 * Re-expand a whitespace-collapsed quote (e.g. derived from `bodyPreview`,
 * where the server collapses `\s+` → ` `) into line-per-quote form so the
 * `···` expander (`QuotedReplyBlock`) can parse `>` depth and render nested
 * rails. Idempotent on already-multiline quotes: those pass through unchanged.
 *
 * Strategy for single-line input:
 *  1. Put each `On … wrote:` header on its own line.
 *  2. Start a new line before each `>` marker preceded by non-`>` content,
 *     keeping consecutive `>` runs (depth) together on one line.
 */
export function normalizeQuoteForDisplay(quote: string): string {
  if (quote.includes("\n")) return quote;
  let s = quote;
  s = s.replace(/\s*(On [^\n]*?\bwrote:)/g, "\n$1");
  s = s.replace(/([^>\n])\s+(>+)/g, "$1\n$2");
  return s.replace(/^\n+/, "").trim();
}
