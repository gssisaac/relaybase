"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_HEIGHT_PX = 260;

export function OverviewExpandableBody({
  children,
  className,
  maxHeight = DEFAULT_MAX_HEIGHT_PX,
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || expanded) return;

    const prevMax = el.style.maxHeight;
    el.style.maxHeight = "none";
    const fullHeight = el.scrollHeight;
    el.style.maxHeight = prevMax;

    setCanExpand(fullHeight > maxHeight + 1);
  }, [children, maxHeight, expanded]);

  const clamped = canExpand && !expanded;

  return (
    <div className="group/expand relative">
      <div
        ref={innerRef}
        className={cn(clamped && "overflow-hidden", className)}
        style={clamped ? { maxHeight } : undefined}
      >
        {children}
      </div>

      {clamped ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card from-40% via-card/75 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-0.5 opacity-0 transition-opacity group-hover/expand:opacity-100 group-focus-within/expand:opacity-100">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(true)}
            >
              Show more
            </Button>
          </div>
        </>
      ) : null}

      {canExpand && expanded ? (
        <div className="mt-2 flex justify-center border-t border-border/40 pt-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(false)}
          >
            Show less
          </Button>
        </div>
      ) : null}
    </div>
  );
}
