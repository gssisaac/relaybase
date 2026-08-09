const QUOTE_HEADER_RE = /^On .+ wrote:\s*$/;
/** Gmail often wraps: `On … <email>\nwrote:` */
const QUOTE_HEADER_TWO_LINE_RE = /^On .+\nwrote:\s*$/;
const QUOTED_LINE_RE = /^>/;

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
 * Split HTML email body before common quoted-history containers
 * (Gmail / Yahoo / Proton / generic blockquote).
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
      if (replyHtml.trim()) {
        return { replyHtml, quoteHtml: quoteHtml.length ? quoteHtml : null };
      }
    }
    return { replyHtml: html, quoteHtml: null };
  }
  const replyHtml = html.slice(0, match.index).replace(/\s+$/g, "");
  const quoteHtml = html.slice(match.index);
  if (!replyHtml.trim()) {
    return { replyHtml: html, quoteHtml: null };
  }
  return { replyHtml, quoteHtml: quoteHtml.length ? quoteHtml : null };
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
  const textSplit = splitQuotedBody(rawText);
  if (textSplit.quote) {
    return {
      bodyText: textSplit.reply,
      bodyHtml: undefined,
      quoteText: textSplit.quote,
    };
  }

  const html = input.bodyHtml?.trim();
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
