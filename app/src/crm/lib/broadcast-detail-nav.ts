import type { BroadcastDetailTab } from "@/crm/lib/paths";
import type { BroadcastStatus } from "@/lib/crm/api";

const ALL_TABS: BroadcastDetailTab[] = [
  "content",
  "publish",
  "recipients",
  "stats",
  "settings",
];

/** Header tabs for a broadcast detail — draft hides recipients/stats (no send yet). */
export function broadcastDetailNavTabs(
  status: BroadcastStatus | undefined,
): BroadcastDetailTab[] {
  if (!status || status === "draft") {
    return ["content", "publish", "settings"];
  }
  if (status === "scheduled") {
    return ["content", "publish", "recipients", "settings"];
  }
  return ALL_TABS;
}

export function normalizeBroadcastDetailTab(
  tab: BroadcastDetailTab,
  status: BroadcastStatus | undefined,
): BroadcastDetailTab {
  const allowed = broadcastDetailNavTabs(status);
  if (allowed.includes(tab)) return tab;
  if (tab === "recipients" || tab === "stats") return "publish";
  return "content";
}
