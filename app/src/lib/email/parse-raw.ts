export type ParsedEmail = {
  subject: string;
  fromEmail: string;
  fromName?: string;
  bodyText: string;
  bodyHtml?: string;
};

/** Decode RFC 2047 encoded-words in headers (=?UTF-8?Q?...?=). */
export function decodeMimeHeader(value: string): string {
  const parts: string[] = [];
  const re = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) parts.push(value.slice(last, m.index));
    const enc = m[2].toUpperCase();
    const payload = m[3];
    try {
      if (enc === "B") {
        parts.push(Buffer.from(payload, "base64").toString("utf8"));
      } else {
        const qp = payload
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        parts.push(qp);
      }
    } catch {
      parts.push(payload);
    }
    last = m.index + m[0].length;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts.join("").replace(/\s+/g, " ").trim();
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function decodePartBody(body: string, encoding: string): string {
  const enc = encoding.toLowerCase();
  if (enc === "base64") {
    try {
      return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
    } catch {
      return body;
    }
  }
  if (enc === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }
  return body;
}

function parseHeaderBlock(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  let current = "";
  for (const line of lines) {
    if (/^[\t ]/.test(line) && current) {
      headers[current] += " " + line.trim();
    } else {
      const idx = line.indexOf(":");
      if (idx > 0) {
        current = line.slice(0, idx).trim().toLowerCase();
        headers[current] = line.slice(idx + 1).trim();
      }
    }
  }
  return headers;
}

function splitHeadersBody(raw: string): { headers: string; body: string } {
  const match = /\r?\n\r?\n/.exec(raw);
  if (!match || match.index === undefined) {
    return { headers: "", body: raw };
  }
  return {
    headers: raw.slice(0, match.index),
    body: raw.slice(match.index + match[0].length),
  };
}

function getBoundary(contentType: string): string | null {
  const m = /boundary\s*=\s*"?([^";\r\n]+)"?/i.exec(contentType);
  return m?.[1]?.trim() ?? null;
}

type MimePart = { headers: Record<string, string>; body: string };

function splitMultipart(body: string, boundary: string): MimePart[] {
  const delim = `--${boundary}`;
  const chunks = body.split(delim);
  const parts: MimePart[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.replace(/^--\s*$/m, "").trim();
    if (!trimmed || trimmed === "--") continue;
    const { headers, body: partBody } = splitHeadersBody(trimmed);
    parts.push({ headers: parseHeaderBlock(headers), body: partBody.trim() });
  }
  return parts;
}

function extractBodies(
  raw: string,
  topHeaders: Record<string, string>,
): { text?: string; html?: string } {
  const contentType = topHeaders["content-type"] ?? "text/plain";
  const transferEncoding = topHeaders["content-transfer-encoding"] ?? "";

  if (/multipart\//i.test(contentType)) {
    const boundary = getBoundary(contentType);
    if (!boundary) return {};
    const out: { text?: string; html?: string } = {};
    for (const part of splitMultipart(raw, boundary)) {
      const partType = part.headers["content-type"] ?? "text/plain";
      const nested = extractBodies(part.body, part.headers);
      if (nested.text && !out.text) out.text = nested.text;
      if (nested.html && !out.html) out.html = nested.html;
      if (/multipart\//i.test(partType)) continue;
      const enc = part.headers["content-transfer-encoding"] ?? "";
      const decoded = decodePartBody(part.body, enc);
      if (/text\/html/i.test(partType) && !out.html) out.html = decoded;
      else if (/text\/plain/i.test(partType) && !out.text) out.text = decoded;
    }
    return out;
  }

  const decoded = decodePartBody(raw, transferEncoding);
  if (/text\/html/i.test(contentType)) return { html: decoded };
  return { text: decoded };
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Minimal HTML for iframe srcDoc — strips scripts and event handlers. */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function parseRawEmail(raw: string): ParsedEmail {
  const { headers: headerBlock, body } = splitHeadersBody(raw);
  const topHeaders = parseHeaderBlock(headerBlock);

  const subjectRaw =
    topHeaders.subject ??
    /^Subject:\s*(.*)$/im.exec(raw)?.[1]?.trim() ??
    "(no subject)";
  const subject = decodeMimeHeader(subjectRaw);

  const fromHeader =
    topHeaders.from ?? /^From:\s*(.*)$/im.exec(raw)?.[1]?.trim() ?? "";
  const angle = /<([^>]+)>/.exec(fromHeader);
  const fromEmail = angle?.[1] ?? fromHeader.replace(/"/g, "").trim();
  const nameMatch = /^([^<]+)</.exec(fromHeader);
  const fromName = nameMatch?.[1]?.replace(/"/g, "").trim();

  const { text, html } = extractBodies(body, topHeaders);

  let bodyText = text?.trim() ?? "";
  let bodyHtml = html?.trim();

  if (!bodyText && bodyHtml) {
    bodyText = stripHtmlToText(bodyHtml);
  }
  if (!bodyText && !bodyHtml) {
    const fallback = body.trim();
    if (!/^Content-Type:/im.test(fallback) && !/^--[0-9a-z]/im.test(fallback)) {
      bodyText = fallback;
    }
  }

  if (bodyHtml) {
    bodyHtml = sanitizeEmailHtml(bodyHtml);
  }

  return {
    subject,
    fromEmail,
    fromName: fromName || undefined,
    bodyText: bodyText || "(no body)",
    bodyHtml: bodyHtml || undefined,
  };
}
