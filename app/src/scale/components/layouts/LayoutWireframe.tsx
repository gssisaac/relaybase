"use client";

import { cn } from "@/lib/utils";

export type LayoutWireframeVariant =
  | "minimal"
  | "header"
  | "card"
  | "plain"
  | "dark"
  | "editorial"
  | "launch"
  | "warm"
  | "digest"
  | "receipt"
  | "ticket"
  | "letter"
  | "spotlight";

export function LayoutWireframe({
  variant,
  className,
}: {
  variant: LayoutWireframeVariant;
  className?: string;
}) {
  if (variant === "plain") {
    return (
      <div className={cn("pointer-events-none px-0.5", className)} aria-hidden>
        <div className="space-y-1.5">
          <div className="h-1 w-full rounded bg-muted-foreground/25" />
          <div className="h-1 w-[92%] rounded bg-muted-foreground/20" />
          <div className="h-1 w-[75%] rounded bg-muted-foreground/15" />
        </div>
      </div>
    );
  }

  const shellClass = cn(
    "pointer-events-none overflow-hidden rounded border border-border/80",
    variant === "card" && "p-1 bg-muted/30",
    variant === "dark" && "border-zinc-700/80 bg-zinc-950",
    variant === "warm" && "border-amber-900/10 bg-[#f7f5f0]",
    variant === "letter" && "border-stone-200 bg-[#fafaf9]",
    variant === "spotlight" && "border-zinc-800 bg-[#f5f5f4]",
    variant !== "card" &&
      variant !== "dark" &&
      variant !== "warm" &&
      variant !== "letter" &&
      variant !== "spotlight" &&
      "bg-muted/30",
  );

  const innerClass = cn(
    "rounded-sm p-2",
    variant === "card" && "border border-border/60 bg-background",
    variant === "dark" && "bg-zinc-900",
    variant === "editorial" && "border border-border/40 bg-background",
    variant === "launch" && "overflow-hidden bg-background p-0",
    variant === "warm" && "border border-amber-900/10 bg-white",
    variant === "letter" && "border border-stone-200/80 bg-white",
    variant === "digest" && "overflow-hidden bg-background p-0",
    variant === "ticket" && "overflow-hidden bg-background p-0",
    variant === "receipt" && "border border-border/70 bg-background",
    variant === "spotlight" && "border-2 border-zinc-900 bg-background p-0",
    variant !== "card" &&
      variant !== "dark" &&
      variant !== "editorial" &&
      variant !== "launch" &&
      variant !== "warm" &&
      variant !== "letter" &&
      variant !== "digest" &&
      variant !== "ticket" &&
      variant !== "receipt" &&
      variant !== "spotlight" &&
      "bg-background",
  );

  const bodyLines = (
    <div
      className={cn(
        "space-y-1",
        (variant === "launch" || variant === "ticket") && "p-2 pt-1.5",
        variant === "digest" && "p-2",
        variant === "spotlight" && "p-2",
      )}
    >
      <div
        className={cn(
          "h-1 w-full rounded",
          variant === "dark" ? "bg-zinc-500/40" : "bg-muted-foreground/20",
        )}
      />
      <div
        className={cn(
          "h-1 w-[80%] rounded",
          variant === "dark" ? "bg-zinc-500/30" : "bg-muted-foreground/15",
        )}
      />
      <div
        className={cn(
          "h-1 w-[60%] rounded",
          variant === "dark" ? "bg-zinc-500/20" : "bg-muted-foreground/10",
        )}
      />
    </div>
  );

  return (
    <div className={cn(shellClass, className)} aria-hidden>
      <div className={innerClass}>
        {variant === "header" || variant === "warm" ? (
          <div className="mb-1.5 flex items-center gap-1 px-0.5">
            <div className="size-2.5 shrink-0 rounded-sm bg-muted-foreground/25" />
            <div className="h-1 flex-1 rounded-sm bg-muted-foreground/20" />
          </div>
        ) : null}
        {variant === "letter" ? (
          <div className="mb-1.5 flex items-center gap-1.5 border-b border-border/40 pb-1.5">
            <div className="size-3 shrink-0 rounded-full bg-stone-400/40" />
            <div className="space-y-0.5 flex-1">
              <div className="h-1 w-12 rounded-sm bg-stone-700/40" />
              <div className="h-0.5 w-8 rounded-sm bg-stone-400/30" />
            </div>
          </div>
        ) : null}
        {variant === "receipt" ? (
          <div className="mb-1.5 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <div className="h-1.5 w-10 rounded-sm bg-muted-foreground/30" />
              <div className="h-1 w-6 rounded-sm bg-muted-foreground/20" />
            </div>
            <div className="border-t border-dashed border-border/70" />
          </div>
        ) : null}
        {variant === "ticket" ? (
          <div className="bg-slate-900 p-1.5 text-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="size-3.5 shrink-0 border border-white/20 bg-white/15" />
              <div className="flex-1 space-y-0.5">
                <div className="h-1 w-14 rounded-sm bg-white/40" />
                <div className="h-0.5 w-8 rounded-sm bg-white/20" />
              </div>
            </div>
            <div className="mt-1 border-t border-dashed border-white/20" />
          </div>
        ) : null}
        {variant === "spotlight" ? (
          <div>
            <div className="flex items-center justify-between border-b-2 border-zinc-900 px-2 py-1">
              <div className="h-1.5 w-12 rounded-sm bg-zinc-900" />
              <div className="h-1 w-5 rounded-sm bg-zinc-700" />
            </div>
            <div className="border-b border-zinc-900 bg-zinc-100 px-2 py-0.5">
              <div className="h-0.5 w-16 rounded-sm bg-zinc-500" />
            </div>
          </div>
        ) : null}
        {variant === "dark" ? (
          <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
            <div className="flex flex-1 items-center gap-1">
              <div className="size-2.5 shrink-0 rounded-sm bg-zinc-500/50" />
              <div className="h-1 flex-1 rounded-sm bg-zinc-500/35" />
            </div>
            <div className="h-1.5 w-6 shrink-0 rounded-sm bg-zinc-600/50" />
          </div>
        ) : null}
        {variant === "editorial" ? (
          <div className="mb-1.5 space-y-1 border-b border-double border-foreground/25 pb-1.5 text-center">
            <div className="mx-auto h-1.5 w-[70%] rounded-sm bg-muted-foreground/30" />
            <div className="mx-auto h-1 w-[45%] rounded-sm bg-muted-foreground/15" />
          </div>
        ) : null}
        {variant === "launch" ? (
          <div className="mb-0 h-6 w-full bg-gradient-to-r from-indigo-400/50 via-violet-400/40 to-pink-400/40" />
        ) : null}
        {variant === "digest" ? (
          <>
            <div className="h-0.5 w-full bg-indigo-500/70" />
            <div className="flex items-center justify-between gap-1 border-b border-border/50 px-2 py-1">
              <div className="h-1.5 flex-1 rounded-sm bg-muted-foreground/25" />
              <div className="h-1 w-5 shrink-0 rounded-sm bg-muted-foreground/15" />
            </div>
          </>
        ) : null}
        {bodyLines}
      </div>
    </div>
  );
}
