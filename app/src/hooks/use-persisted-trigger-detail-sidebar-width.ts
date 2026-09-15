"use client";

import { useCallback, useRef, useState } from "react";

import {
  AUTOMATION_DETAIL_SIDEBAR_WIDTH,
  clampTriggerDetailSidebarWidth,
} from "@/lib/navigation/sidebar-width";

const WIDTH_PREFIX = "relaybase:automation-detail-sidebar-width:";

function readTriggerDetailSidebarWidth(userId: string): number {
  if (typeof window === "undefined" || !userId) {
    return AUTOMATION_DETAIL_SIDEBAR_WIDTH.default;
  }
  try {
    const raw = localStorage.getItem(`${WIDTH_PREFIX}${userId}`);
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return clampTriggerDetailSidebarWidth(parsed);
      }
    }
  } catch {
    // ignore
  }
  return AUTOMATION_DETAIL_SIDEBAR_WIDTH.default;
}

function writeTriggerDetailSidebarWidth(userId: string, width: number) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(
      `${WIDTH_PREFIX}${userId}`,
      String(clampTriggerDetailSidebarWidth(width)),
    );
  } catch {
    // ignore
  }
}

export function usePersistedTriggerDetailSidebarWidth(userId: string) {
  const [width, setWidth] = useState(() => readTriggerDetailSidebarWidth(userId));
  const widthRef = useRef(width);
  widthRef.current = width;

  const onResize = useCallback((delta: number) => {
    setWidth((prev) => {
      const next = clampTriggerDetailSidebarWidth(prev + delta);
      widthRef.current = next;
      return next;
    });
  }, []);

  const persist = useCallback(() => {
    writeTriggerDetailSidebarWidth(userId, widthRef.current);
  }, [userId]);

  return { width, onResize, persist };
}
