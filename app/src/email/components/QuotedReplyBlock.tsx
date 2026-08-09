"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type FlatLine =
  | { kind: "header"; depth: number; text: string }
  | { kind: "body"; depth: number; text: string }
  | { kind: "blank"; depth: number };

type Seg =
  | { type: "text"; text: string; header?: boolean }
  | { type: "blank" }
  | { type: "quote"; children: Seg[] };

const QUOTE_HEADER_RE = /^On .+ wrote:\s*$/;

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
    if (depth === 0 && QUOTE_HEADER_RE.test(rest)) {
      return { kind: "header" as const, depth: 0, text: rest };
    }
    // Nested "On … wrote:" keeps quote depth so bars continue through headers.
    if (QUOTE_HEADER_RE.test(rest)) {
      return { kind: "header" as const, depth, text: rest };
    }
    return { kind: "body" as const, depth, text: rest };
  });

  // Blank lines inherit surrounding depth so rails don't break.
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

/** Nest flat depth-tagged lines into quote blocks with continuous borders. */
function nestSegments(items: FlatLine[], minDepth: number): Seg[] {
  const out: Seg[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i]!;
    if (item.depth <= minDepth) {
      if (item.kind === "blank") out.push({ type: "blank" });
      else {
        out.push({
          type: "text",
          text: item.text,
          header: item.kind === "header",
        });
      }
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

function QuoteSegments({ segments }: { segments: Seg[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "blank") {
          return <div key={i} className="h-3" />;
        }
        if (seg.type === "text") {
          return (
            <div
              key={i}
              className={cn(
                "min-w-0 whitespace-pre-wrap wrap-break-word",
                seg.header
                  ? "text-xs text-muted-foreground/70"
                  : undefined,
              )}
            >
              {seg.text || "\u00a0"}
            </div>
          );
        }
        return (
          <div
            key={i}
            className="border-l-2 border-foreground/35 pl-2.5"
          >
            <QuoteSegments segments={seg.children} />
          </div>
        );
      })}
    </>
  );
}

export function QuotedReplyBlock({
  quote,
  className,
}: {
  quote: string;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const segments = React.useMemo(
    () => nestSegments(parseFlatLines(quote), 0),
    [quote],
  );

  return (
    <div className={cn("select-none", className)}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quoted text" : "Expand quoted text"}
        className="inline-flex h-6 items-center justify-center rounded-md border border-border/50 bg-muted/40 px-2 text-xs tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        ···
      </button>
      {expanded ? (
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <QuoteSegments segments={segments} />
        </div>
      ) : null}
    </div>
  );
}
