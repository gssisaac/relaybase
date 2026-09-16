"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Users,
  Zap,
} from "lucide-react";

import type { TriggerStatus, CampaignStatus } from "@/lib/scale/api";

export type AudienceDetailTab = "contacts" | "history" | "settings";

export type CampaignsSection = "list" | "sent" | "in-progress";

/** Scale UI route for subscriber groups (list + detail query routes). */
export const SCALE_SUBSCRIBERS_PATH = "/scale/subscribers";

export function useScalePaths() {
  const base = "/scale";
  const subscribers = SCALE_SUBSCRIBERS_PATH;
  const campaigns = "/scale/campaigns";
  const campaignsSent = "/scale/campaigns/sent";
  const campaignsInProgress = "/scale/campaigns/in-progress";
  const templates = "/scale/templates";
  const layouts = "/scale/layouts";
  const triggers = "/scale/triggers";
  const schedule = "/scale/schedule";
  const overview = "/scale/overview";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: overview, label: "Overview", icon: LayoutDashboard },
    { href: templates, label: "Templates", icon: LayoutTemplate },
    { href: layouts, label: "Layouts", icon: Layers },
    { href: triggers, label: "Triggers", icon: Zap },
    { href: campaigns, label: "Campaigns", icon: Mail },
    { href: schedule, label: "Schedule", icon: CalendarDays },
    { href: subscribers, label: "Subscribers", icon: Users },
  ];

  return {
    base,
    subscribers,
    campaigns,
    campaignsSent,
    campaignsInProgress,
    templates,
    layouts,
    triggers,
    schedule,
    overview,
    tabs,
  };
}

export function campaignsSectionHref(section: CampaignsSection = "list"): string {
  if (section === "sent") return "/scale/campaigns/sent";
  if (section === "in-progress") return "/scale/campaigns/in-progress";
  return "/scale/campaigns";
}

export function campaignsSectionFromLocation(
  pathname: string,
  searchParams: { get: (name: string) => string | null },
): CampaignsSection {
  const view = searchParams.get("view")?.trim().toLowerCase();
  if (view === "sent" || /\/campaigns\/sent\/?$/.test(pathname)) return "sent";
  if (view === "in-progress" || /\/campaigns\/in-progress\/?$/.test(pathname)) {
    return "in-progress";
  }
  return "list";
}

export function scaleAudienceDetailHref(
  groupId: string,
  tab: AudienceDetailTab = "contacts",
): string {
  const params = new URLSearchParams();
  params.set("id", groupId.trim());
  if (tab !== "contacts") params.set("tab", tab);
  return `${SCALE_SUBSCRIBERS_PATH}?${params.toString()}`;
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

/** Campaign detail tabs — content, publish, recipients, stats, settings. */
export type CampaignDetailTab = "content" | "publish" | "recipients" | "stats" | "settings";

function campaignDetailTabQueryParam(
  tab: CampaignDetailTab,
  status: CampaignStatus | undefined,
): CampaignDetailTab | null {
  if (!status || status === "draft") {
    return tab === "content" ? null : tab;
  }
  return tab === "stats" ? null : tab;
}

export function campaignDetailHref(
  id: string,
  tab: CampaignDetailTab = "content",
  status?: CampaignStatus,
): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  const tabParam = campaignDetailTabQueryParam(tab, status);
  if (tabParam) params.set("tab", tabParam);
  return `/scale/campaigns?${params.toString()}`;
}

export function campaignDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { campaignId: string; tab: CampaignDetailTab | null } | null {
  const campaignId = searchParams.get("id")?.trim() ?? "";
  if (!campaignId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  if (!raw) {
    return { campaignId, tab: null };
  }
  let tab: CampaignDetailTab = "content";
  if (raw === "publish" || raw === "recipients" || raw === "stats" || raw === "settings") {
    tab = raw;
  } else if (raw === "content") {
    tab = "content";
  } else if (raw === "audience") {
    tab = "recipients";
  }
  return { campaignId, tab };
}

export const TRIGGER_DETAIL_TABS = ["preview", "trigger", "stats", "settings"] as const;

export type TriggerDetailTab = (typeof TRIGGER_DETAIL_TABS)[number];

export function isTriggerDetailTab(value: string): value is TriggerDetailTab {
  return (TRIGGER_DETAIL_TABS as readonly string[]).includes(value);
}

function encodeTriggerPathId(id: string): string {
  return encodeURIComponent(id.trim());
}

function decodeTriggerPathId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveTriggerDetailTab(
  tab: TriggerDetailTab | null | undefined,
  _status?: TriggerStatus,
): TriggerDetailTab {
  if (tab) return tab;
  return "preview";
}

export function triggerDetailHref(
  id: string,
  tab?: TriggerDetailTab,
  status?: TriggerStatus,
): string {
  const resolved = resolveTriggerDetailTab(tab, status);
  return `/scale/triggers/${encodeTriggerPathId(id)}/${resolved}`;
}

export function triggerContentEditHref(id: string): string {
  return `/scale/triggers/${encodeTriggerPathId(id)}/edit`;
}

export function triggersStatsHref(): string {
  return "/scale/triggers/trigger-stats";
}

export type TriggerPathDetail = {
  triggerId: string;
  tab: TriggerDetailTab | null;
  isEdit: boolean;
};

/** Nested `/scale/triggers/{id}/{preview|trigger|stats|settings|edit}`. */
export function triggerDetailFromPathname(pathname: string): TriggerPathDetail | null {
  const match = pathname.match(/^\/scale\/triggers\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  const rawId = match[1] ?? "";
  if (!rawId || rawId === "edit" || rawId === "trigger-stats") return null;
  const triggerId = decodeTriggerPathId(rawId).trim();
  if (!triggerId) return null;
  const rawSeg = match[2]?.trim().toLowerCase();
  if (!rawSeg) {
    return { triggerId, tab: null, isEdit: false };
  }
  if (rawSeg === "edit" || rawSeg === "content") {
    return { triggerId, tab: "preview", isEdit: true };
  }
  if (rawSeg === "activity") {
    return { triggerId, tab: "stats", isEdit: false };
  }
  if (isTriggerDetailTab(rawSeg)) {
    return { triggerId, tab: rawSeg, isEdit: false };
  }
  return { triggerId, tab: "preview", isEdit: false };
}

export function triggerTabFromPathname(pathname: string): TriggerDetailTab {
  return triggerDetailFromPathname(pathname)?.tab ?? "preview";
}

export function triggerDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { triggerId: string; tab: TriggerDetailTab | null } | null {
  const triggerId = searchParams.get("id")?.trim() ?? "";
  if (!triggerId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  if (!raw) {
    return { triggerId, tab: null };
  }
  let tab: TriggerDetailTab = "preview";
  if (raw === "activity") {
    tab = "stats";
  } else if (raw === "content") {
    tab = "preview";
  } else if (isTriggerDetailTab(raw)) {
    tab = raw;
  }
  return { triggerId, tab };
}
