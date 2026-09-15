"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarDays, LayoutDashboard, Mail, Users, Zap } from "lucide-react";

import type { AutomationStatus, BroadcastStatus } from "@/lib/scale/api";

export type AudienceDetailTab = "contacts" | "history" | "settings";

export type BroadcastsSection = "list" | "sent" | "in-progress";

export function useScalePaths() {
  const base = "/scale";
  const audience = "/scale/audience";
  const broadcasts = "/scale/broadcasts";
  const broadcastsSent = "/scale/broadcasts/sent";
  const broadcastsInProgress = "/scale/broadcasts/in-progress";
  const automations = "/scale/automations";
  const schedule = "/scale/schedule";
  const overview = "/scale/overview";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: overview, label: "Overview", icon: LayoutDashboard },
    { href: schedule, label: "Schedule", icon: CalendarDays },
    { href: automations, label: "Automations", icon: Zap },
    { href: broadcasts, label: "Broadcasts", icon: Mail },
    { href: audience, label: "Audience", icon: Users },
  ];

  return {
    base,
    audience,
    broadcasts,
    broadcastsSent,
    broadcastsInProgress,
    automations,
    schedule,
    overview,
    tabs,
  };
}

export function broadcastsSectionHref(section: BroadcastsSection = "list"): string {
  if (section === "sent") return "/scale/broadcasts/sent";
  if (section === "in-progress") return "/scale/broadcasts/in-progress";
  return "/scale/broadcasts";
}

export function broadcastsSectionFromLocation(
  pathname: string,
  searchParams: { get: (name: string) => string | null },
): BroadcastsSection {
  const view = searchParams.get("view")?.trim().toLowerCase();
  if (view === "sent" || /\/broadcasts\/sent\/?$/.test(pathname)) return "sent";
  if (view === "in-progress" || /\/broadcasts\/in-progress\/?$/.test(pathname)) {
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
  return `/scale/audience?${params.toString()}`;
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

/** Broadcast detail tabs — content, publish, recipients, stats, settings. */
export type BroadcastDetailTab = "content" | "publish" | "recipients" | "stats" | "settings";

/** Omit `tab` in the URL only for the status-specific landing tab (draft → content, else → stats). */
function broadcastDetailTabQueryParam(
  tab: BroadcastDetailTab,
  status: BroadcastStatus | undefined,
): BroadcastDetailTab | null {
  if (!status || status === "draft") {
    return tab === "content" ? null : tab;
  }
  return tab === "stats" ? null : tab;
}

export function broadcastDetailHref(
  id: string,
  tab: BroadcastDetailTab = "content",
  status?: BroadcastStatus,
): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  const tabParam = broadcastDetailTabQueryParam(tab, status);
  if (tabParam) params.set("tab", tabParam);
  return `/scale/broadcasts?${params.toString()}`;
}

export function broadcastDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { broadcastId: string; tab: BroadcastDetailTab | null } | null {
  const broadcastId = searchParams.get("id")?.trim() ?? "";
  if (!broadcastId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  if (!raw) {
    return { broadcastId, tab: null };
  }
  let tab: BroadcastDetailTab = "content";
  if (raw === "publish" || raw === "recipients" || raw === "stats" || raw === "settings") {
    tab = raw;
  } else if (raw === "content") {
    tab = "content";
  } else if (raw === "audience") {
    tab = "recipients";
  }
  return { broadcastId, tab };
}

export type AutomationDetailTab = "preview" | "trigger" | "stats" | "settings";

function automationDetailTabQueryParam(
  tab: AutomationDetailTab,
  status: AutomationStatus | undefined,
): AutomationDetailTab | null {
  if (!status || status === "draft") {
    return tab === "preview" ? null : tab;
  }
  return tab === "stats" ? null : tab;
}

export function automationDetailHref(
  id: string,
  tab: AutomationDetailTab = "preview",
  status?: AutomationStatus,
): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  const tabParam = automationDetailTabQueryParam(tab, status);
  if (tabParam) params.set("tab", tabParam);
  return `/scale/automations?${params.toString()}`;
}

export function automationContentEditHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/scale/automations/edit?${params.toString()}`;
}

export function automationDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { automationId: string; tab: AutomationDetailTab | null } | null {
  const automationId = searchParams.get("id")?.trim() ?? "";
  if (!automationId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  if (!raw) {
    return { automationId, tab: null };
  }
  let tab: AutomationDetailTab = "preview";
  if (raw === "activity") {
    tab = "stats";
  } else if (raw === "content") {
    tab = "preview";
  } else if (
    raw === "preview" ||
    raw === "trigger" ||
    raw === "stats" ||
    raw === "settings"
  ) {
    tab = raw;
  }
  return { automationId, tab };
}

/** @deprecated use `broadcasts` from `useScalePaths()` */
export const legacyCampaignsPath = "/scale/campaigns";
