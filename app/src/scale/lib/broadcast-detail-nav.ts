import type { BroadcastDetailTab } from "@/scale/lib/paths";
import type { BroadcastStatus } from "@/lib/scale/api";

const DRAFT_TABS: BroadcastDetailTab[] = ["content", "publish", "settings"];

const NON_DRAFT_LEADING: BroadcastDetailTab[] = ["stats", "recipients"];
const NON_DRAFT_TRAILING: BroadcastDetailTab[] = ["content", "settings"];

/** Default landing tab when `tab` is omitted from the broadcast detail URL. */
export function defaultBroadcastDetailTab(
  status: BroadcastStatus | undefined,
): BroadcastDetailTab {
  if (!status || status === "draft") return "content";
  return "stats";
}

/** Header tabs for a broadcast detail — draft hides recipients/stats (no send yet). */
export function broadcastDetailNavTabs(
  status: BroadcastStatus | undefined,
): BroadcastDetailTab[] {
  if (!status || status === "draft") {
    return DRAFT_TABS;
  }
  return [...NON_DRAFT_LEADING, ...NON_DRAFT_TRAILING];
}

export function normalizeBroadcastDetailTab(
  tab: BroadcastDetailTab,
  status: BroadcastStatus | undefined,
): BroadcastDetailTab {
  const allowed = broadcastDetailNavTabs(status);
  if (allowed.includes(tab)) return tab;
  if (!status || status === "draft") {
    if (tab === "recipients" || tab === "stats") return "publish";
    return "content";
  }
  return defaultBroadcastDetailTab(status);
}
