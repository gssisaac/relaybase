"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type PanelSplitHandleProps = {
  onResize: (deltaX: number) => void;
  onResizeEnd?: () => void;
  className?: string;
};

export function PanelSplitHandle({
  onResize,
  onResizeEnd,
  className,
}: PanelSplitHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onResizeEnd?.();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onResize, onResizeEnd]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      className={cn(
        "group relative z-10 w-1 shrink-0 cursor-col-resize bg-transparent",
        "hover:bg-primary/30 active:bg-primary/50",
        className,
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        lastX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
