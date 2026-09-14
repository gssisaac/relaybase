"use client";

import type { LucideIcon } from "lucide-react";
import { Kanban, Mail, Users } from "lucide-react";

import type { AudienceDetailTab } from "@/console/lib/paths";

/** CRM mode routes — mirrors `console/lib/paths.ts`'s `useDashboardPaths()`. */
export function useCrmPaths() {
  const base = "/crm";
  const audience = "/crm/audience";
  const pipeline = "/crm/pipeline";
  const campaigns = "/crm/campaigns";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: audience, label: "Audience", icon: Users },
    { href: pipeline, label: "Pipeline", icon: Kanban },
    { href: campaigns, label: "Campaigns", icon: Mail },
  ];

  return { base, audience, pipeline, campaigns, tabs };
}

export type CampaignDetailTab = "overview" | "content" | "publish";

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

/** Campaign detail — `/crm/campaigns?id=&tab=` (static-export safe, same as broadcasts). */
export function campaignDetailHref(
  id: string,
  tab: CampaignDetailTab = "overview",
): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  if (tab !== "overview") params.set("tab", tab);
  return `/crm/campaigns?${params.toString()}`;
}

export function campaignDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { campaignId: string; tab: CampaignDetailTab } | null {
  const campaignId = searchParams.get("id")?.trim() ?? "";
  if (!campaignId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  const tab: CampaignDetailTab =
    raw === "content" || raw === "publish" || raw === "progress"
      ? raw === "progress"
        ? "publish"
        : raw
      : "overview";
  return { campaignId, tab };
}
