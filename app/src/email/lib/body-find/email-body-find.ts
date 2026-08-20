/**
 * In-message find (⌘F / Ctrl+F) — search visible email body text, including
 * HTML rendered in sandboxed iframes. Not a mail command.
 */

export const EMAIL_BODY_FIND_ATTR = "data-email-body-find";
export const EMAIL_FIND_OPEN_EVENT = "relaybase-email-find-open";
export const EMAIL_HTML_FRAME_READY_EVENT = "relaybase-email-html-ready";

export const EMAIL_FIND_HIGHLIGHT = "relaybase-email-find";
export const EMAIL_FIND_HIGHLIGHT_CURRENT = "relaybase-email-find-current";

const MARK_ATTR = "data-email-find";

export type QueryOffset = { start: number; end: number };

export type FlatPiece = { start: number; length: number };

export function findQueryOffsets(
  haystack: string,
  query: string,
): QueryOffset[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const hay = haystack.toLocaleLowerCase();
  const out: QueryOffset[] = [];
  let from = 0;
  while (from <= hay.length - needle.length) {
    const i = hay.indexOf(needle, from);
    if (i < 0) break;
    out.push({ start: i, end: i + needle.length });
    from = i + needle.length;
  }
  return out;
}

export function wrapFindIndex(
  index: number,
  count: number,
  delta: number,
): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

/** Map a flattened-string offset back onto a text-node piece. */
export function locateFlatOffset(
  pieces: FlatPiece[],
  offset: number,
  edge: "start" | "end",
): { index: number; local: number } | null {
  if (pieces.length === 0 || offset < 0) return null;
  const last = pieces[pieces.length - 1]!;
  const total = last.start + last.length;
  if (edge === "end" && offset === total) {
    return { index: pieces.length - 1, local: last.length };
  }
  if (offset > total || (edge === "start" && offset === total && total > 0)) {
    return null;
  }
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    const end = piece.start + piece.length;
    if (piece.length === 0) continue;
    if (edge === "start") {
      if (offset >= piece.start && offset < end) {
        return { index: i, local: offset - piece.start };
      }
    } else if (offset > piece.start && offset <= end) {
      return { index: i, local: offset - piece.start };
    }
  }
  return null;
}

const sessions = new WeakMap<HTMLElement, Range[]>();

export function collectEmailBodyFindRoots(container: HTMLElement): Element[] {
  const candidates: Element[] = [];
  for (const el of container.querySelectorAll(`[${EMAIL_BODY_FIND_ATTR}]`)) {
    if (el instanceof HTMLIFrameElement) {
      const body = el.contentDocument?.body;
      if (body) candidates.push(body);
    } else {
      candidates.push(el);
    }
  }
  return candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el)),
  );
}

export function selectedTextForFind(container: HTMLElement): string {
  const clamp = (text: string) => {
    const trimmed = text.replace(/\s+/g, " ").trim();
    return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
  };
  const top = window.getSelection()?.toString() ?? "";
  if (top.trim()) return clamp(top);
  for (const el of container.querySelectorAll("iframe")) {
    if (!(el instanceof HTMLIFrameElement)) continue;
    const text = el.contentDocument?.getSelection()?.toString() ?? "";
    if (text.trim()) return clamp(text);
  }
  return "";
}

export function clearEmailBodyFind(container: HTMLElement): void {
  const docs = new Set<Document>([container.ownerDocument ?? document]);
  for (const root of collectEmailBodyFindRoots(container)) {
    const doc = root.ownerDocument;
    if (doc) docs.add(doc);
  }
  for (const doc of docs) {
    deleteHighlights(doc, EMAIL_FIND_HIGHLIGHT);
    deleteHighlights(doc, EMAIL_FIND_HIGHLIGHT_CURRENT);
    if (doc !== document && doc.body) unwrapFindMarks(doc.body);
  }
  sessions.delete(container);
}

export function applyEmailBodyFind(
  container: HTMLElement,
  query: string,
  activeIndex: number,
): number {
  clearEmailBodyFind(container);
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const ranges: Range[] = [];
  for (const root of collectEmailBodyFindRoots(container)) {
    ranges.push(...rangesInRoot(root, trimmed));
  }
  sessions.set(container, ranges);
  const index =
    ranges.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), ranges.length - 1);
  paintRanges(ranges, index);
  scrollRangeIntoView(ranges[index]);
  return ranges.length;
}

export function setEmailBodyFindActive(
  container: HTMLElement,
  activeIndex: number,
): void {
  const ranges = sessions.get(container) ?? [];
  if (ranges.length === 0) return;
  const index = wrapFindIndex(activeIndex, ranges.length, 0);
  paintRanges(ranges, index);
  scrollRangeIntoView(ranges[index]);
}

function rangesInRoot(root: Element, query: string): Range[] {
  const doc = root.ownerDocument;
  if (!doc) return [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("script, style, noscript, [data-email-body-find-ignore]")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  type LivePiece = { node: Text; start: number; length: number };
  const pieces: LivePiece[] = [];
  let text = "";
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const node = current as Text;
    pieces.push({ node, start: text.length, length: node.data.length });
    text += node.data;
  }

  const offsets = findQueryOffsets(text, query);
  const meta: FlatPiece[] = pieces.map((p) => ({
    start: p.start,
    length: p.length,
  }));
  const out: Range[] = [];
  for (const { start, end } of offsets) {
    const startAt = locateFlatOffset(meta, start, "start");
    const endAt = locateFlatOffset(meta, end, "end");
    if (!startAt || !endAt) continue;
    const startNode = pieces[startAt.index]?.node;
    const endNode = pieces[endAt.index]?.node;
    if (!startNode || !endNode) continue;
    const range = doc.createRange();
    range.setStart(startNode, startAt.local);
    range.setEnd(endNode, endAt.local);
    out.push(range);
  }
  return out;
}

function paintRanges(ranges: Range[], activeIndex: number): void {
  const byDoc = new Map<Document, { others: Range[]; current: Range[] }>();
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    const doc =
      range.startContainer.ownerDocument ?? (range.startContainer as Document);
    let entry = byDoc.get(doc);
    if (!entry) {
      entry = { others: [], current: [] };
      byDoc.set(doc, entry);
    }
    if (i === activeIndex) entry.current.push(range);
    else entry.others.push(range);
  }

  for (const [doc, { others, current }] of byDoc) {
    if (setHighlights(doc, others, current)) continue;
    if (doc !== document && doc.body) wrapFindMarks(doc, others, current);
  }
}

function scrollRangeIntoView(range: Range | undefined): void {
  if (!range) return;
  const node = range.startContainer;
  const el = node instanceof Element ? node : node.parentElement;
  el?.scrollIntoView({ block: "center", inline: "nearest" });
}

type HighlightRegistryLike = {
  set: (name: string, highlight: object) => void;
  delete: (name: string) => void;
};

function highlightRegistry(doc: Document): HighlightRegistryLike | null {
  const css = doc.defaultView?.CSS as
    | { highlights?: HighlightRegistryLike }
    | undefined;
  return css?.highlights ?? null;
}

function makeHighlight(doc: Document, ranges: Range[]): object | null {
  const Ctor = doc.defaultView?.Highlight as
    | (new (...ranges: Range[]) => object)
    | undefined;
  if (!Ctor || ranges.length === 0) return null;
  return new Ctor(...ranges);
}

function setHighlights(
  doc: Document,
  others: Range[],
  current: Range[],
): boolean {
  const registry = highlightRegistry(doc);
  if (!registry) return false;
  const otherHl = makeHighlight(doc, others);
  const currentHl = makeHighlight(doc, current);
  if (otherHl) registry.set(EMAIL_FIND_HIGHLIGHT, otherHl);
  else registry.delete(EMAIL_FIND_HIGHLIGHT);
  if (currentHl) registry.set(EMAIL_FIND_HIGHLIGHT_CURRENT, currentHl);
  else registry.delete(EMAIL_FIND_HIGHLIGHT_CURRENT);
  return true;
}

function deleteHighlights(doc: Document, name: string): void {
  highlightRegistry(doc)?.delete(name);
}

function unwrapFindMarks(root: Element): void {
  const marks = Array.from(root.querySelectorAll(`mark[${MARK_ATTR}]`));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

function wrapFindMarks(
  doc: Document,
  others: Range[],
  current: Range[],
): void {
  if (doc.body) unwrapFindMarks(doc.body);
  const tagged = [
    ...others.map((range) => ({ range, current: false })),
    ...current.map((range) => ({ range, current: true })),
  ];
  for (let i = tagged.length - 1; i >= 0; i--) {
    const item = tagged[i]!;
    try {
      const mark = doc.createElement("mark");
      mark.setAttribute(MARK_ATTR, item.current ? "current" : "");
      const contents = item.range.extractContents();
      mark.appendChild(contents);
      item.range.insertNode(mark);
    } catch {
      // Range became stale or spanned a restricted boundary — skip.
    }
  }
}

export const EMAIL_FIND_MARK_CSS = `
  ::highlight(${EMAIL_FIND_HIGHLIGHT}) {
    background-color: #fde047;
    color: inherit;
  }
  ::highlight(${EMAIL_FIND_HIGHLIGHT_CURRENT}) {
    background-color: #ea580c;
    color: #ffffff;
  }
  mark[${MARK_ATTR}] {
    background: #fde047;
    color: inherit;
    padding: 0;
  }
  mark[${MARK_ATTR}="current"] {
    background: #ea580c;
    color: #ffffff;
  }
`;
