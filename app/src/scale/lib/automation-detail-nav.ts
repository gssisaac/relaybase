import type { AutomationStatus } from "@/lib/scale/api";
import type { AutomationDetailTab } from "@/scale/lib/paths";

export function defaultAutomationDetailTab(status: AutomationStatus): AutomationDetailTab {
  return status === "draft" ? "preview" : "stats";
}

export function normalizeAutomationDetailTab(
  tab: AutomationDetailTab | "activity" | "content",
  _status: AutomationStatus,
): AutomationDetailTab {
  if (tab === "activity") return "stats";
  if (tab === "content") return "preview";
  return tab;
}

export function automationDetailNavTabs(_status: AutomationStatus): AutomationDetailTab[] {
  return ["preview", "trigger", "stats", "settings"];
}
