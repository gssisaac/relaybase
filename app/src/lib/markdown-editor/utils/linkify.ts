/** Bare URL linkification in BlockNote blocks (from Railmark markdown-links.ts). */

const HTTP_URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'`]+/gi;

export type FoundHttpUrl = { href: string; start: number; end: number };

export function findHttpUrlsInText(text: string): FoundHttpUrl[] {
  const found: FoundHttpUrl[] = [];
  const re = new RegExp(HTTP_URL_IN_TEXT_RE.source, HTTP_URL_IN_TEXT_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const href = match[0].replace(/[),.;:!?]+$/g, "");
    if (!href) continue;
    found.push({ href, start: match.index, end: match.index + href.length });
  }
  return found;
}

type InlineText = { type: "text"; text: string; styles?: Record<string, unknown> };
type InlineLink = { type: "link"; href: string; content: InlineText[] };

function isInlineText(node: unknown): node is InlineText {
  return (
    !!node &&
    typeof node === "object" &&
    (node as InlineText).type === "text" &&
    typeof (node as InlineText).text === "string"
  );
}

function isInlineLink(node: unknown): node is InlineLink {
  return !!node && typeof node === "object" && (node as InlineLink).type === "link";
}

export function linkifyInlineContent(content: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const node of content) {
    if (isInlineLink(node)) {
      out.push(node);
      continue;
    }
    if (!isInlineText(node)) {
      out.push(node);
      continue;
    }
    const urls = findHttpUrlsInText(node.text);
    if (urls.length === 0) {
      out.push(node);
      continue;
    }
    let cursor = 0;
    for (const url of urls) {
      if (url.start > cursor) {
        out.push({ ...node, text: node.text.slice(cursor, url.start) });
      }
      out.push({
        type: "link",
        href: url.href,
        content: [
          {
            type: "text",
            text: node.text.slice(url.start, url.end),
            styles: node.styles ?? {},
          },
        ],
      } satisfies InlineLink);
      cursor = url.end;
    }
    if (cursor < node.text.length) {
      out.push({ ...node, text: node.text.slice(cursor) });
    }
  }
  return out;
}

function linkifyTableRow(row: { cells?: unknown[] }): { cells?: unknown[] } {
  if (!Array.isArray(row.cells)) return row;
  return {
    ...row,
    cells: row.cells.map((cell) => {
      if (Array.isArray(cell)) return linkifyInlineContent(cell);
      if (cell && typeof cell === "object" && Array.isArray((cell as { content?: unknown }).content)) {
        return { ...cell, content: linkifyInlineContent((cell as { content: unknown[] }).content) };
      }
      return cell;
    }),
  };
}

export function linkifyParsedBlocks<T>(blocks: T[]): T[] {
  return blocks.map((block) => linkifyParsedBlock(block) as T);
}

function linkifyParsedBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const next = { ...(block as Record<string, unknown>) };
  const content = next.content;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const table = content as { type?: string; rows?: { cells?: unknown[] }[] };
    if (table.type === "tableContent" && Array.isArray(table.rows)) {
      next.content = {
        ...table,
        rows: table.rows.map((row) => linkifyTableRow(row)),
      };
    }
  } else if (Array.isArray(content)) {
    next.content = linkifyInlineContent(content);
  }
  if (Array.isArray(next.children)) {
    next.children = next.children.map(linkifyParsedBlock);
  }
  return next;
}
