"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyEmailBodyFind,
  clearEmailBodyFind,
  EMAIL_FIND_OPEN_EVENT,
  EMAIL_HTML_FRAME_READY_EVENT,
  selectedTextForFind,
  setEmailBodyFindActive,
  wrapFindIndex,
} from "@/email/lib/body-find/email-body-find";

export function EmailBodyFindHost({
  enabled,
  paletteOpen,
  resetKey,
  children,
}: {
  enabled: boolean;
  paletteOpen: boolean;
  resetKey: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndexRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  activeIndexRef.current = activeIndex;

  const close = useCallback(() => {
    setOpen(false);
    const root = rootRef.current;
    if (root) clearEmailBodyFind(root);
  }, []);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  }, []);

  const openFind = useCallback(() => {
    const root = rootRef.current;
    const selected = root ? selectedTextForFind(root) : "";
    if (selected) setQuery(selected);
    setOpen(true);
    focusInput();
  }, [focusInput]);

  const go = useCallback(
    (delta: number) => {
      if (matchCount <= 0) return;
      const next = wrapFindIndex(activeIndexRef.current, matchCount, delta);
      setActiveIndex(next);
      const root = rootRef.current;
      if (root) setEmailBodyFindActive(root, next);
    },
    [matchCount],
  );

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      const root = rootRef.current;
      if (root) clearEmailBodyFind(root);
    }
  }, [enabled]);

  useEffect(() => {
    setActiveIndex(0);
    activeIndexRef.current = 0;
  }, [query, resetKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!open || !enabled || !root) {
      if (root) clearEmailBodyFind(root);
      setMatchCount(0);
      return;
    }

    window.dispatchEvent(new Event(EMAIL_FIND_OPEN_EVENT));

    let cancelled = false;
    const run = (keepIndex: boolean) => {
      if (cancelled || !rootRef.current) return;
      const index = keepIndex ? activeIndexRef.current : 0;
      const count = applyEmailBodyFind(rootRef.current, query, index);
      setMatchCount(count);
      if (!keepIndex) {
        setActiveIndex(0);
        activeIndexRef.current = 0;
      } else if (count > 0 && activeIndexRef.current >= count) {
        const last = count - 1;
        setActiveIndex(last);
        activeIndexRef.current = last;
      }
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => run(false));
    });
    const onReady = () => run(true);
    root.addEventListener(EMAIL_HTML_FRAME_READY_EVENT, onReady);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      root.removeEventListener(EMAIL_HTML_FRAME_READY_EVENT, onReady);
    };
  }, [enabled, open, query, resetKey]);

  useEffect(() => {
    return () => {
      const root = rootRef.current;
      if (root) clearEmailBodyFind(root);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        close();
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "f" && !event.shiftKey) {
        if (!enabled || paletteOpen) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openFind();
        return;
      }

      if (!open) return;
      if (key === "g") {
        event.preventDefault();
        event.stopImmediatePropagation();
        go(event.shiftKey ? -1 : 1);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [close, enabled, go, open, openFind, paletteOpen]);

  const countLabel =
    !query.trim() || !open
      ? ""
      : matchCount === 0
        ? "No results"
        : `${activeIndex + 1} of ${matchCount}`;

  return (
    <div ref={rootRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
      {open ? (
        <div className="pointer-events-none absolute right-3 top-12 z-20">
          <div
            role="search"
            className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1 shadow-md"
          >
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  go(event.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Find in message"
              aria-label="Find in message"
              className="h-7 w-48 border-0 bg-transparent px-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            <span
              className="min-w-16 shrink-0 px-1 text-right text-xs tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {countLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous match"
              disabled={matchCount === 0}
              onClick={() => go(-1)}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next match"
              disabled={matchCount === 0}
              onClick={() => go(1)}
            >
              <ChevronDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Close find"
              onClick={close}
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
