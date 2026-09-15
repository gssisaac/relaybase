"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** In-app back/forward that mirrors Link / router.push history (and gestures). */
export function useSidebarHistoryNavigation() {
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

/** Registers ⌘[ / ⌘] (Ctrl on non-Mac) for in-app page history. */
export function useSidebarHistoryShortcuts(
  goBack: () => void,
  goForward: () => void,
) {
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
}
