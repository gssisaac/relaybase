import type { AutomationStatus } from "@/lib/scale/api";
import type { AutomationDetailTab } from "@/scale/lib/paths";

/** Landing tab when the URL has no tab segment (sidebar switches keep the current tab). */
export function defaultAutomationDetailTab(_status: AutomationStatus): AutomationDetailTab {
  return "preview";
}

export function normalizeAutomationDetailTab(
  tab: AutomationDetailTab | "activity" | "content",
  _status: AutomationStatus,
): AutomationDetailTab {
  if (tab === "activity") return "stats";
  if (tab === "content") return "preview";
  if (tab === "trigger") return "settings";
  return tab;
}

export function automationDetailNavTabs(_status: AutomationStatus): AutomationDetailTab[] {
  return ["preview", "stats", "settings"];
}
