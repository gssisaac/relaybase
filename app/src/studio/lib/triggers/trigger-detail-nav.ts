import type { TriggerStatus } from "@/lib/studio/api";
import type { TriggerDetailTab } from "@/studio/lib/paths";

/** Landing tab when the URL has no tab segment (sidebar switches keep the current tab). */
export function defaultTriggerDetailTab(_status: TriggerStatus): TriggerDetailTab {
  return "config";
}

export function normalizeTriggerDetailTab(
  tab: TriggerDetailTab | "activity" | "content" | "preview" | "trigger" | "settings",
  _status: TriggerStatus,
): TriggerDetailTab {
  if (tab === "activity") return "stats";
  if (
    tab === "content" ||
    tab === "preview" ||
    tab === "trigger" ||
    tab === "settings"
  ) {
    return "config";
  }
  return tab;
}

export function triggerDetailNavTabs(_status: TriggerStatus): TriggerDetailTab[] {
  return ["config", "stats"];
}
