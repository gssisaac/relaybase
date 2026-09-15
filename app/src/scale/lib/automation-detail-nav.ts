import type { AutomationStatus } from "@/lib/scale/api";
import type { AutomationDetailTab } from "@/scale/lib/paths";

export function defaultAutomationDetailTab(status: AutomationStatus): AutomationDetailTab {
  return status === "draft" ? "content" : "stats";
}

export function normalizeAutomationDetailTab(
  tab: AutomationDetailTab | "activity",
  _status: AutomationStatus,
): AutomationDetailTab {
  if (tab === "activity") return "stats";
  return tab;
}

export function automationDetailNavTabs(_status: AutomationStatus): AutomationDetailTab[] {
  return ["content", "trigger", "stats", "settings"];
}
