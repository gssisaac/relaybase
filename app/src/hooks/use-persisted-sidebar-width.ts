"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clampSidebarWidth,
  SIDEBAR_WIDTH,
} from "@/lib/navigation/sidebar-width";
import {
  hydrateSidebarState,
  readSidebarWidth,
  writeSidebarWidth,
} from "@/lib/navigation/sidebar-mode";

export function usePersistedSidebarWidth(userId: string) {
  const [width, setWidth] = useState(() =>
    userId ? readSidebarWidth(userId) : SIDEBAR_WIDTH.default,
  );
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    let cancelled = false;
    void hydrateSidebarState(userId).then((state) => {
      if (cancelled) return;
      const next = clampSidebarWidth(state.width ?? SIDEBAR_WIDTH.default);
      widthRef.current = next;
      setWidth(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const onResize = useCallback((delta: number) => {
    setWidth((prev) => {
      const next = clampSidebarWidth(prev + delta);
      widthRef.current = next;
      return next;
    });
  }, []);

  const persist = useCallback(() => {
    if (!userId) return;
    writeSidebarWidth(userId, widthRef.current);
  }, [userId]);

  return { width, onResize, persist };
}
