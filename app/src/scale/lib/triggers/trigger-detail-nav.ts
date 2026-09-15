import type { TriggerStatus } from "@/lib/scale/api";
import type { TriggerDetailTab } from "@/scale/lib/paths";

/** Landing tab when the URL has no tab segment (sidebar switches keep the current tab). */
export function defaultTriggerDetailTab(_status: TriggerStatus): TriggerDetailTab {
  return "preview";
}

export function normalizeTriggerDetailTab(
  tab: TriggerDetailTab | "activity" | "content",
  _status: TriggerStatus,
): TriggerDetailTab {
  if (tab === "activity") return "stats";
  if (tab === "content") return "preview";
  if (tab === "trigger") return "settings";
  return tab;
}

export function triggerDetailNavTabs(_status: TriggerStatus): TriggerDetailTab[] {
  return ["preview", "stats", "settings"];
}
