import type { MouseEvent as ReactMouseEvent } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="combobox"], [role="tab"], [role="menuitem"], [role="link"], [data-slot="select-trigger"], [data-slot="dropdown-menu-trigger"], [data-slot="tabs-trigger"], [data-tauri-drag-region="false"], .relaybase-no-drag';

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

async function startWindowDrag(): Promise<void> {
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

export const dragRegionDataAttribute = {
  "data-tauri-drag-region": true,
} as const;
