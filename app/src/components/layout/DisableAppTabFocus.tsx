"use client";

import { useEffect } from "react";

/** Opt-in marker for regions where Tab may move focus (e.g. compose fields). */
export const ALLOW_TAB_FOCUS_ATTR = "data-allow-tab-focus";

const FIELD_SELECTOR = [
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[role="combobox"]:not([disabled]):not([tabindex="-1"])',
  '[role="textbox"]:not([disabled]):not([tabindex="-1"])',
].join(",");

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

function tabFields(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(
    isVisible,
  );
}

/**
 * Blocks Tab / Shift+Tab focus movement app-wide so it does not fight mail
 * shortcuts and other keyboard layers. Containers marked with
 * `data-allow-tab-focus` keep Tab cycling among their text fields only.
 */
export function DisableAppTabFocus() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || event.isComposing) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        event.preventDefault();
        return;
      }

      const zone = target.closest(`[${ALLOW_TAB_FOCUS_ATTR}]`);
      if (!zone) {
        event.preventDefault();
        return;
      }

      const fields = tabFields(zone);
      if (fields.length === 0) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      let index = active ? fields.indexOf(active) : -1;
      if (index < 0 && active) {
        // Focus may be on a non-field control inside the zone (e.g. button).
        index = event.shiftKey ? 0 : fields.length - 1;
      }

      const nextIndex = event.shiftKey
        ? (index <= 0 ? fields.length : index) - 1
        : (index + 1) % fields.length;

      fields[nextIndex]?.focus();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
