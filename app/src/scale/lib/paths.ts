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

export const AUTOMATION_DETAIL_TABS = ["preview", "trigger", "stats", "settings"] as const;

export type AutomationDetailTab = (typeof AUTOMATION_DETAIL_TABS)[number];

export function isAutomationDetailTab(value: string): value is AutomationDetailTab {
  return (AUTOMATION_DETAIL_TABS as readonly string[]).includes(value);
}

function encodeAutomationPathId(id: string): string {
  return encodeURIComponent(id.trim());
}

function decodeAutomationPathId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveAutomationDetailTab(
  tab: AutomationDetailTab | null | undefined,
  _status?: AutomationStatus,
): AutomationDetailTab {
  if (tab) return tab;
  return "preview";
}

export function automationDetailHref(
  id: string,
  tab?: AutomationDetailTab,
  status?: AutomationStatus,
): string {
  const resolved = resolveAutomationDetailTab(tab, status);
  return `/scale/automations/${encodeAutomationPathId(id)}/${resolved}`;
}

export function automationContentEditHref(id: string): string {
  return `/scale/automations/${encodeAutomationPathId(id)}/edit`;
}

export function automationsTriggerStatsHref(): string {
  return "/scale/automations/trigger-stats";
}

export type AutomationPathDetail = {
  automationId: string;
  tab: AutomationDetailTab | null;
  isEdit: boolean;
};

/** Nested `/scale/automations/{id}/{preview|trigger|stats|settings|edit}`. */
export function automationDetailFromPathname(pathname: string): AutomationPathDetail | null {
  const match = pathname.match(/^\/scale\/automations\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  const rawId = match[1] ?? "";
  if (!rawId || rawId === "edit" || rawId === "trigger-stats") return null;
  const automationId = decodeAutomationPathId(rawId).trim();
  if (!automationId) return null;
  const rawSeg = match[2]?.trim().toLowerCase();
  if (!rawSeg) {
    return { automationId, tab: null, isEdit: false };
  }
  if (rawSeg === "edit" || rawSeg === "content") {
    return { automationId, tab: "preview", isEdit: true };
  }
  if (rawSeg === "activity") {
    return { automationId, tab: "stats", isEdit: false };
  }
  if (isAutomationDetailTab(rawSeg)) {
    return { automationId, tab: rawSeg, isEdit: false };
  }
  return { automationId, tab: "preview", isEdit: false };
}

export function automationTabFromPathname(pathname: string): AutomationDetailTab {
  return automationDetailFromPathname(pathname)?.tab ?? "preview";
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
  } else if (isAutomationDetailTab(raw)) {
    tab = raw;
  }
  return { automationId, tab };
}

/** @deprecated use `broadcasts` from `useScalePaths()` */
export const legacyCampaignsPath = "/scale/campaigns";
