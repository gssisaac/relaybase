"use client";

import { makeAutoObservable } from "mobx";

type ListItemFocusSource = "hover" | "visible-top";

export class ListItemStateStore {
  /** Key of the item that keyboard navigation should treat as current. */
  focusKey: string | null = null;
  /** What set the focus key: explicit hover or visible-top fallback. */
  focusSource: ListItemFocusSource | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setFocus(key: string, source: ListItemFocusSource) {
    // Hover overrides the visible-top fallback; visible-top never overrides
    // an explicit hover anchor.
    if (source === "visible-top" && this.focusSource === "hover") {
      return;
    }
    this.focusKey = key;
    this.focusSource = source;
  }

  clearFocus() {
    this.focusKey = null;
    this.focusSource = null;
  }
}
