/**
 * BlockNote / GFM markdown → readable plain text for plain-text email layouts.
 * Keep in sync with app/src/scale/lib/markdown/markdown-to-plain-email-text.ts
 */

const MERGE_TAG_RE = /\{\{[^}]+\}\}/g;
const CODE_FENCE_RE = /^```(?:[^\n]*)\n?([\s\S]*?)```$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const ORDERED_LIST_RE = /^(\s*)(\d+)\.\s+(.*)$/;
const UNORDERED_LIST_RE = /^(\s*)([-*+])\s+(.*)$/;
const BLOCKQUOTE_RE = /^(>\s?)(.*)$/;
const HR_RE = /^(\*{3,}|-{3,}|_{3,})\s*$/;

function protectMergeTags(input: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const text = input.replace(MERGE_TAG_RE, (tag) => {
    const key = `\x00MERGE${tags.length}\x00`;
    tags.push(tag);
    return key;
  });
  return { text, tags };
}

function restoreMergeTags(text: string, tags: string[]): string {
  let out = text;
  for (let i = 0; i < tags.length; i++) {
    out = out.replaceAll(`\x00MERGE${i}\x00`, tags[i]!);
  }
  return out;
}

function stripInlineMarkdown(line: string): string {
  const { text: protectedLine, tags } = protectMergeTags(line);

  let s = protectedLine;

  s = s.replace(/<video\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/video>/gi, "$1");

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, url: string) => {
    const label = alt?.trim();
    return label || url;
  });

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label: string) => label.trim());

  s = s.replace(/`([^`]+)`/g, "$1");

  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
  s = s.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1");

  s = s.replace(/\\$/g, "");

  return restoreMergeTags(s, tags);
}

function isBlankLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || trimmed === "\u00a0" || trimmed === "&nbsp;";
}

function pushParagraph(out: string[], paragraphLines: string[]): void {
  if (paragraphLines.length === 0) return;
  const joined = paragraphLines
    .map((line) => stripInlineMarkdown(line.trim()))
    .join("\n")
    .trimEnd();
  if (joined) out.push(joined);
}

function lastLineIsListItem(out: string[]): boolean {
  const last = out[out.length - 1];
  if (!last) return false;
  return /^\s*•\s/.test(last) || /^\s*\d+\.\s/.test(last);
}

export function markdownToPlainEmailText(markdown: string): string {
  const normalized = (markdown ?? "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const lines = normalized.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (isBlankLine(line)) {
      let j = i + 1;
      while (j < lines.length && isBlankLine(lines[j]!)) j += 1;
      if (j < lines.length && lastLineIsListItem(out)) {
        const next = lines[j]!;
        if (UNORDERED_LIST_RE.test(next) || ORDERED_LIST_RE.test(next)) {
          i = j;
          continue;
        }
      }
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      i += 1;
      continue;
    }

    if (HR_RE.test(line.trim())) {
      out.push("---");
      out.push("");
      i += 1;
      continue;
    }

    const fenceOpen = line.trimStart().startsWith("```");
    if (fenceOpen) {
      const chunk = lines.slice(i).join("\n");
      const match = chunk.match(CODE_FENCE_RE);
      if (match) {
        const code = match[1]?.replace(/\n$/, "") ?? "";
        if (code.trim()) out.push(code);
        out.push("");
        i += match[0].split("\n").length;
        continue;
      }
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      out.push(stripInlineMarkdown(heading[2]!.trim()));
      out.push("");
      i += 1;
      continue;
    }

    const ul = line.match(UNORDERED_LIST_RE);
    const ol = line.match(ORDERED_LIST_RE);
    if (ul || ol) {
      while (i < lines.length) {
        const current = lines[i]!;
        if (isBlankLine(current)) break;

        const ordered = current.match(ORDERED_LIST_RE);
        const unordered = current.match(UNORDERED_LIST_RE);
        if (ordered) {
          out.push(`${ordered[1]}${ordered[2]}. ${stripInlineMarkdown(ordered[3]!)}`);
          i += 1;
          continue;
        }
        if (unordered) {
          const indent = unordered[1] ?? "";
          out.push(`${indent}• ${stripInlineMarkdown(unordered[3]!)}`);
          i += 1;
          continue;
        }
        break;
      }
      let j = i;
      while (j < lines.length && isBlankLine(lines[j]!)) j += 1;
      if (
        j < lines.length &&
        (UNORDERED_LIST_RE.test(lines[j]!) || ORDERED_LIST_RE.test(lines[j]!))
      ) {
        i = j;
        continue;
      }
      out.push("");
      continue;
    }

    const quote = line.match(BLOCKQUOTE_RE);
    if (quote) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const q = current.match(BLOCKQUOTE_RE);
        if (!q) break;
        quoteLines.push(stripInlineMarkdown(q[2]!));
        i += 1;
      }
      pushParagraph(out, quoteLines.map((l) => `> ${l}`));
      out.push("");
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i]!;
      if (isBlankLine(current)) break;
      if (
        HEADING_RE.test(current) ||
        UNORDERED_LIST_RE.test(current) ||
        ORDERED_LIST_RE.test(current) ||
        BLOCKQUOTE_RE.test(current) ||
        HR_RE.test(current.trim()) ||
        current.trimStart().startsWith("```")
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }
    pushParagraph(out, paragraphLines);
    out.push("");
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  while (out.length > 0 && out[0] === "") out.shift();

  return out.join("\n");
}
