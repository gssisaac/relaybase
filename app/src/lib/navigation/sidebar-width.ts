export const SIDEBAR_WIDTH = {
  default: 240,
  min: 180,
  max: 480,
} as const;

/** Automation detail list panel (inside Scale automations). */
export const AUTOMATION_DETAIL_SIDEBAR_WIDTH = {
  default: 300,
  min: SIDEBAR_WIDTH.min,
  max: SIDEBAR_WIDTH.max,
} as const;

export function clampSidebarWidth(width: number): number {
  return Math.min(
    SIDEBAR_WIDTH.max,
    Math.max(SIDEBAR_WIDTH.min, Math.round(width)),
  );
}

export function clampTriggerDetailSidebarWidth(width: number): number {
  return Math.min(
    AUTOMATION_DETAIL_SIDEBAR_WIDTH.max,
    Math.max(AUTOMATION_DETAIL_SIDEBAR_WIDTH.min, Math.round(width)),
  );
}

export function parseSidebarWidth(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampSidebarWidth(value);
  }
  return null;
}
