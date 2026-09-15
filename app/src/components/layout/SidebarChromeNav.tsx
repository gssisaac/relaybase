"use client";

import { ChevronLeft, ChevronRight, PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

type SidebarChromeNavProps = {
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onCollapse?: () => void;
  showCollapse?: boolean;
  className?: string;
};

/** Back / forward (and optional collapse) in the sidebar title band — railmark-style chrome. */
export function SidebarChromeNav({
  canBack,
  canForward,
  onBack,
  onForward,
  onCollapse,
  showCollapse = false,
  className,
}: SidebarChromeNavProps) {
  const { isDesktop, noDragClassName } = useDesktopChrome();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5",
        noDragClassName,
        className,
      )}
      {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Back (⌘[)"
        title="Back (⌘[)"
        disabled={!canBack}
        onClick={onBack}
      >
        <ChevronLeft />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Forward (⌘])"
        title="Forward (⌘])"
        disabled={!canForward}
        onClick={onForward}
      >
        <ChevronRight />
      </Button>
      {showCollapse && onCollapse ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          onClick={onCollapse}
        >
          <PanelLeftClose />
        </Button>
      ) : null}
    </div>
  );
}
