import type { MouseEvent as ReactMouseEvent } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="combobox"], [role="tab"], [role="menuitem"], [role="link"], [data-slot="select-trigger"], [data-slot="dropdown-menu-trigger"], [data-slot="tabs-trigger"], [data-tauri-drag-region="false"], .relaybase-no-drag';

const DRAG_THRESHOLD_PX = 4;

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export async function startWindowDrag(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // Web build, missing API package, or Tauri unavailable.
  }
}

export function onDragRegionMouseDown(event: ReactMouseEvent<HTMLElement>): void {
  if (!isDesktopRuntime()) return;
  if (event.button !== 0) return;
  if (isInteractiveDragTarget(event.target)) return;

  event.preventDefault();
  void startWindowDrag();
}

/**
 * Make a text field move the window on drag, while still allowing click-to-focus
 * and normal caret/selection once focused.
 */
export function onDraggableFieldMouseDown(
  event: ReactMouseEvent<HTMLInputElement | HTMLTextAreaElement>,
): void {
  if (!isDesktopRuntime()) return;
  if (event.button !== 0) return;

  const field = event.currentTarget;
  // Already editing — keep native text selection / caret behavior.
  if (document.activeElement === field) return;

  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  const cleanup = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  const onMove = (ev: MouseEvent) => {
    if (dragging) return;
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) {
      return;
    }
    dragging = true;
    cleanup();
    void startWindowDrag();
  };

  const onUp = () => {
    cleanup();
    if (!dragging) field.focus();
  };

  // Defer focus until mouseup so a drag can take over instead.
  event.preventDefault();
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

export const dragRegionDataAttribute = {
  "data-tauri-drag-region": true,
} as const;
