import type { CampaignDetailTab } from "@/scale/lib/paths";
import type { CampaignStatus } from "@/lib/scale/api";

const DRAFT_TABS: CampaignDetailTab[] = ["content", "publish", "settings"];

const NON_DRAFT_LEADING: CampaignDetailTab[] = ["stats", "recipients"];
const NON_DRAFT_TRAILING: CampaignDetailTab[] = ["content", "settings"];

/** Default landing tab when `tab` is omitted from the campaign detail URL. */
export function defaultCampaignDetailTab(
  status: CampaignStatus | undefined,
): CampaignDetailTab {
  if (!status || status === "draft") return "content";
  return "stats";
}

/** Header tabs for campaign detail — draft hides recipients/stats (no send yet). */
export function campaignDetailNavTabs(
  status: CampaignStatus | undefined,
): CampaignDetailTab[] {
  if (!status || status === "draft") {
    return DRAFT_TABS;
  }
  return [...NON_DRAFT_LEADING, ...NON_DRAFT_TRAILING];
}

export function normalizeCampaignDetailTab(
  tab: CampaignDetailTab,
  status: CampaignStatus | undefined,
): CampaignDetailTab {
  const allowed = campaignDetailNavTabs(status);
  if (allowed.includes(tab)) return tab;
  if (!status || status === "draft") {
    if (tab === "recipients" || tab === "stats") return "publish";
    return "content";
  }
  return defaultCampaignDetailTab(status);
}
