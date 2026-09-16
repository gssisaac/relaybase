import type { NewsletterDetailTab } from "@/scale/lib/paths";
import type { NewsletterStatus } from "@/lib/scale/api";

const DRAFT_TABS: NewsletterDetailTab[] = ["content", "publish", "settings"];

const NON_DRAFT_LEADING: NewsletterDetailTab[] = ["stats", "recipients"];
const NON_DRAFT_TRAILING: NewsletterDetailTab[] = ["content", "settings"];

/** Default landing tab when `tab` is omitted from the newsletter detail URL. */
export function defaultNewsletterDetailTab(
  status: NewsletterStatus | undefined,
): NewsletterDetailTab {
  if (!status || status === "draft") return "content";
  return "stats";
}

/** Header tabs for newsletter detail — draft hides recipients/stats (no send yet). */
export function newsletterDetailNavTabs(
  status: NewsletterStatus | undefined,
): NewsletterDetailTab[] {
  if (!status || status === "draft") {
    return DRAFT_TABS;
  }
  return [...NON_DRAFT_LEADING, ...NON_DRAFT_TRAILING];
}

export function normalizeNewsletterDetailTab(
  tab: NewsletterDetailTab,
  status: NewsletterStatus | undefined,
): NewsletterDetailTab {
  const allowed = newsletterDetailNavTabs(status);
  if (allowed.includes(tab)) return tab;
  if (!status || status === "draft") {
    if (tab === "recipients" || tab === "stats") return "publish";
    return "content";
  }
  return defaultNewsletterDetailTab(status);
}
