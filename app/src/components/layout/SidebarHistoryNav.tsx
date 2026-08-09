"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

/** In-app back/forward that mirrors Link / router.push history (and gestures). */
function useHistoryNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fullPath = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const stackRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const skipRef = useRef<"back" | "forward" | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const stack = stackRef.current;
    const idx = indexRef.current;
    const skip = skipRef.current;
    skipRef.current = null;

    if (skip === "back" || skip === "forward") {
      setCanGoBack(indexRef.current > 0);
      setCanGoForward(indexRef.current < stack.length - 1);
      return;
    }

    if (idx >= 0 && stack[idx] === fullPath) return;

    // Trackpad / browser gesture back or forward.
    if (idx > 0 && stack[idx - 1] === fullPath) {
      indexRef.current = idx - 1;
      setCanGoBack(indexRef.current > 0);
      setCanGoForward(indexRef.current < stack.length - 1);
      return;
    }
    if (idx >= 0 && idx < stack.length - 1 && stack[idx + 1] === fullPath) {
      indexRef.current = idx + 1;
      setCanGoBack(indexRef.current > 0);
      setCanGoForward(indexRef.current < stack.length - 1);
      return;
    }

    if (idx < stack.length - 1) stack.splice(idx + 1);
    if (stack[stack.length - 1] !== fullPath) stack.push(fullPath);
    indexRef.current = stack.length - 1;
    setCanGoBack(indexRef.current > 0);
    setCanGoForward(false);
  }, [fullPath]);

  const goBack = useCallback(() => {
    if (indexRef.current <= 0) return;
    skipRef.current = "back";
    indexRef.current -= 1;
    setCanGoBack(indexRef.current > 0);
    setCanGoForward(indexRef.current < stackRef.current.length - 1);
    router.back();
  }, [router]);

  const goForward = useCallback(() => {
    if (indexRef.current >= stackRef.current.length - 1) return;
    skipRef.current = "forward";
    indexRef.current += 1;
    setCanGoBack(indexRef.current > 0);
    setCanGoForward(indexRef.current < stackRef.current.length - 1);
    router.forward();
  }, [router]);

  return { canGoBack, canGoForward, goBack, goForward };
}

type SidebarHistoryNavProps = {
  collapsed?: boolean;
};

/**
 * Back/forward on the macOS traffic-light strip (right end).
 * Registers ⌘[ / ⌘] (Ctrl on non-Mac).
 */
export function SidebarHistoryNav({ collapsed = false }: SidebarHistoryNavProps) {
  const { isDesktop, isMacOS, noDragClassName } = useDesktopChrome();
  const { canGoBack, canGoForward, goBack, goForward } = useHistoryNavigation();

  // App keyboard layer (capture): ⌘[ / ⌘] (Ctrl on non-Mac) for page history.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.code !== "BracketLeft" && event.code !== "BracketRight") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "BracketLeft") goBack();
      else goForward();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [goBack, goForward]);

  if (!(isDesktop && isMacOS)) return null;

  const backLabel = "Back (⌘[)";
  const forwardLabel = "Forward (⌘])";

  return (
    <div className="flex w-full shrink-0 items-center justify-end pt-1">
      {!collapsed ? (
        <div
          className={cn(
            "mr-2 flex shrink-0 items-center gap-0.5",
            noDragClassName,
          )}
          data-tauri-drag-region="false"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={backLabel}
            title={backLabel}
            disabled={!canGoBack}
            onClick={goBack}
          >
            <ArrowLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={forwardLabel}
            title={forwardLabel}
            disabled={!canGoForward}
            onClick={goForward}
          >
            <ArrowRight />
          </Button>
        </div>
      ) : (
        <div className="h-8 w-px shrink-0 opacity-0" aria-hidden />
      )}
    </div>
  );
}
