export const SIDEBAR_WIDTH = {
  default: 240,
  min: 180,
  max: 480,
} as const;

export function clampSidebarWidth(width: number): number {
  return Math.min(
    SIDEBAR_WIDTH.max,
    Math.max(SIDEBAR_WIDTH.min, Math.round(width)),
  );
}

export function parseSidebarWidth(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampSidebarWidth(value);
  }
  return null;
}
