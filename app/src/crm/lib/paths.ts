"use client";

import type { LucideIcon } from "lucide-react";
import { Mail, Users } from "lucide-react";

export type AudienceDetailTab = "contacts" | "history" | "settings";

/** CRM mode routes — mirrors `console/lib/paths.ts`'s `useDashboardPaths()`. */
export function useCrmPaths() {
  const base = "/crm";
  const audience = "/crm/audience";
  const campaigns = "/crm/campaigns";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: audience, label: "Audience", icon: Users },
    { href: campaigns, label: "Campaigns", icon: Mail },
  ];

  return { base, audience, campaigns, tabs };
}

/** Audience group detail — `/crm/audience?id=&tab=`. */
export function crmAudienceDetailHref(
  groupId: string,
  tab: AudienceDetailTab = "contacts",
): string {
  const params = new URLSearchParams();
  params.set("id", groupId.trim());
  if (tab !== "contacts") params.set("tab", tab);
  return `/crm/audience?${params.toString()}`;
}

export function audienceDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { groupId: string; tab: AudienceDetailTab } | null {
  const groupId = searchParams.get("id")?.trim() ?? "";
  if (!groupId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  const tab: AudienceDetailTab =
    raw === "history" || raw === "settings" ? raw : "contacts";
  return { groupId, tab };
}

/** Campaign detail tabs — subscribers (consent), broadcasts (sends), settings. */
export type CampaignDetailTab = "subscribers" | "broadcasts" | "settings";

/** Campaign detail — `/crm/campaigns?id=&tab=` (static-export safe, no `[id]` segment). */
export function campaignDetailHref(id: string, tab: CampaignDetailTab = "subscribers"): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  if (tab !== "subscribers") params.set("tab", tab);
  return `/crm/campaigns?${params.toString()}`;
}

export function campaignDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { campaignId: string; tab: CampaignDetailTab } | null {
  const campaignId = searchParams.get("id")?.trim() ?? "";
  if (!campaignId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  const tab: CampaignDetailTab =
    raw === "broadcasts" || raw === "settings" ? raw : "subscribers";
  return { campaignId, tab };
}

/** Broadcast detail tabs — content (compose), publish (send/schedule), stats (delivery). */
export type BroadcastDetailTab = "content" | "publish" | "stats";

/**
 * Broadcast detail — `/crm/campaigns?id=&broadcastId=&tab=` — nests under the
 * parent campaign query switch rather than a `/broadcasts/:broadcastId`
 * dynamic segment, same static-export reasoning as `campaignDetailHref`.
 */
export function broadcastDetailHref(
  campaignId: string,
  broadcastId: string,
  tab: BroadcastDetailTab = "content",
): string {
  const params = new URLSearchParams();
  params.set("id", campaignId.trim());
  params.set("broadcastId", broadcastId.trim());
  if (tab !== "content") params.set("tab", tab);
  return `/crm/campaigns?${params.toString()}`;
}

export function broadcastDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { campaignId: string; broadcastId: string; tab: BroadcastDetailTab } | null {
  const campaignId = searchParams.get("id")?.trim() ?? "";
  const broadcastId = searchParams.get("broadcastId")?.trim() ?? "";
  if (!campaignId || !broadcastId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  const tab: BroadcastDetailTab = raw === "publish" || raw === "stats" ? raw : "content";
  return { campaignId, broadcastId, tab };
}
