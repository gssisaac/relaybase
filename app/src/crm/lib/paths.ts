"use client";

import type { LucideIcon } from "lucide-react";
import { Mail, Users } from "lucide-react";

export type AudienceDetailTab = "contacts" | "history" | "settings";

export function useCrmPaths() {
  const base = "/crm";
  const audience = "/crm/audience";
  const broadcasts = "/crm/broadcasts";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: audience, label: "Audience", icon: Users },
    { href: broadcasts, label: "Broadcasts", icon: Mail },
  ];

  return { base, audience, broadcasts, tabs };
}

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

/** Broadcast detail tabs — audience, content, publish, stats, settings. */
export type BroadcastDetailTab = "audience" | "content" | "publish" | "stats" | "settings";

export function broadcastDetailHref(id: string, tab: BroadcastDetailTab = "audience"): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  if (tab !== "audience") params.set("tab", tab);
  return `/crm/broadcasts?${params.toString()}`;
}

export function broadcastDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { broadcastId: string; tab: BroadcastDetailTab } | null {
  const broadcastId = searchParams.get("id")?.trim() ?? "";
  if (!broadcastId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  const tab: BroadcastDetailTab =
    raw === "content" || raw === "publish" || raw === "stats" || raw === "settings"
      ? raw
      : "audience";
  return { broadcastId, tab };
}

/** @deprecated use `broadcasts` from `useCrmPaths()` */
export const legacyCampaignsPath = "/crm/campaigns";
