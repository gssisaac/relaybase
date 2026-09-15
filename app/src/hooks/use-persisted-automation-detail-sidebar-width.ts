"use client";

import { useCallback, useRef, useState } from "react";

import {
  AUTOMATION_DETAIL_SIDEBAR_WIDTH,
  clampAutomationDetailSidebarWidth,
} from "@/lib/navigation/sidebar-width";

const WIDTH_PREFIX = "relaybase:automation-detail-sidebar-width:";

function readAutomationDetailSidebarWidth(userId: string): number {
  if (typeof window === "undefined" || !userId) {
    return AUTOMATION_DETAIL_SIDEBAR_WIDTH.default;
  }
  try {
    const raw = localStorage.getItem(`${WIDTH_PREFIX}${userId}`);
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return clampAutomationDetailSidebarWidth(parsed);
      }
    }
  } catch {
    // ignore
  }
  return AUTOMATION_DETAIL_SIDEBAR_WIDTH.default;
}

function writeAutomationDetailSidebarWidth(userId: string, width: number) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(
      `${WIDTH_PREFIX}${userId}`,
      String(clampAutomationDetailSidebarWidth(width)),
    );
  } catch {
    // ignore
  }
}

export function usePersistedAutomationDetailSidebarWidth(userId: string) {
  const [width, setWidth] = useState(() => readAutomationDetailSidebarWidth(userId));
  const widthRef = useRef(width);
  widthRef.current = width;

  const onResize = useCallback((delta: number) => {
    setWidth((prev) => {
      const next = clampAutomationDetailSidebarWidth(prev + delta);
      widthRef.current = next;
      return next;
    });
  }, []);

  const persist = useCallback(() => {
    writeAutomationDetailSidebarWidth(userId, widthRef.current);
  }, [userId]);

  return { width, onResize, persist };
}
