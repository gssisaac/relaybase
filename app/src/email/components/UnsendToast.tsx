"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RING_SIZE = 20;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CountdownRing({
  durationMs,
  className,
}: {
  durationMs: number;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(RING_CIRCUMFERENCE));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className={cn("-rotate-90", className)}
      aria-hidden
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={RING_STROKE}
        className="text-muted-foreground/25"
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        className="text-foreground"
        style={{
          transition: `stroke-dashoffset ${durationMs}ms linear`,
        }}
      />
    </svg>
  );
}

export function UnsendToastBody({
  durationMs,
  onUnsend,
}: {
  durationMs: number;
  onUnsend: () => void;
}) {
  const totalSeconds = Math.max(1, Math.ceil(durationMs / 1000));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => {
      const remainingMs = durationMs - (Date.now() - startedAt);
      setSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [durationMs]);

  const handleUnsend = useEffectEvent(() => {
    onUnsend();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleUnsend();
    };
    // Capture before mail-layer Escape (back / close compose).
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    // Horizontal inset via shrink-0 spacers — px on a squeezed flex child can
    // collapse inside Sonner's toast width constraints.
    <div className="flex w-[340px] max-w-[min(340px,calc(100vw-2rem))] shrink-0 items-center gap-2.5 rounded-lg border border-border bg-popover py-2.5 text-popover-foreground shadow-lg">
      <span className="w-4 shrink-0" aria-hidden />
      <CountdownRing durationMs={durationMs} className="shrink-0" />
      <span className="min-w-0 flex-1 text-sm font-medium tabular-nums">
        Sending in {secondsLeft}s
      </span>
      <Button
        type="button"
        variant="default"
        size="xs"
        className="shrink-0"
        onClick={onUnsend}
      >
        Unsend
      </Button>
      <span className="w-4 shrink-0" aria-hidden />
    </div>
  );
}
