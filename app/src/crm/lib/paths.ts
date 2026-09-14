"use client";

import type { LucideIcon } from "lucide-react";
import { Kanban, Mail, Users } from "lucide-react";

/** CRM mode routes — mirrors `console/lib/paths.ts`'s `useDashboardPaths()`. */
export function useCrmPaths() {
  const base = "/crm";
  const contacts = "/crm/contacts";
  const pipeline = "/crm/pipeline";
  const campaigns = "/crm/campaigns";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: contacts, label: "Contacts", icon: Users },
    { href: pipeline, label: "Pipeline", icon: Kanban },
    { href: campaigns, label: "Campaigns", icon: Mail },
  ];

  return { base, contacts, pipeline, campaigns, tabs };
}

export type CampaignDetailTab = "overview" | "content" | "publish";

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
