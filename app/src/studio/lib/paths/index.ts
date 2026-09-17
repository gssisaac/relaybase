"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Users,
  Zap,
} from "lucide-react";

import type { TriggerStatus, NewsletterStatus } from "@/studio/api";

export type AudienceDetailTab = "contacts" | "history" | "settings";

export type NewslettersSection = "list" | "sent" | "in-progress";

export type StudioInsightSection = "dashboard" | "analytics";

/** Studio UI route for subscriber groups (list + detail query routes). */
export const STUDIO_SUBSCRIBERS_PATH = "/studio/subscribers";

export function useStudioPaths() {
  const base = "/studio";
  const subscribers = STUDIO_SUBSCRIBERS_PATH;
  const newsletters = "/studio/newsletters";
  const newslettersSent = "/studio/newsletters/sent";
  const newslettersInProgress = "/studio/newsletters/in-progress";
  const templates = "/studio/templates";
  const messages = "/studio/messages";
  const layouts = "/studio/layouts";
  const triggers = "/studio/triggers";
  const schedule = "/studio/schedule";
  const dashboard = "/studio/dashboard";
  const analytics = "/studio/analytics";
  /** Legacy entry — redirects to dashboard. */
  const overview = "/studio/overview";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: dashboard, label: "Dashboard", icon: LayoutDashboard },
    { href: analytics, label: "Analytics", icon: BarChart3 },
    { href: templates, label: "Templates", icon: LayoutTemplate },
    { href: messages, label: "Messages", icon: Mail },
    { href: triggers, label: "Triggers", icon: Zap },
    { href: newsletters, label: "Newsletters", icon: Mail },
    { href: schedule, label: "Schedule", icon: CalendarDays },
    { href: subscribers, label: "Subscribers", icon: Users },
    { href: layouts, label: "Layouts", icon: Layers },
  ];

  return {
    base,
    subscribers,
    newsletters,
    newslettersSent,
    newslettersInProgress,
    templates,
    messages,
    layouts,
    triggers,
    schedule,
    dashboard,
    analytics,
    overview,
    tabs,
  };
}

export function studioInsightSectionHref(section: StudioInsightSection = "dashboard"): string {
  if (section === "analytics") return "/studio/analytics";
  return "/studio/dashboard";
}

export function newslettersSectionHref(section: NewslettersSection = "list"): string {
  if (section === "sent") return "/studio/newsletters/sent";
  if (section === "in-progress") return "/studio/newsletters/in-progress";
  return "/studio/newsletters";
}

export function newslettersSectionFromLocation(
  pathname: string,
  searchParams: { get: (name: string) => string | null },
): NewslettersSection {
  const view = searchParams.get("view")?.trim().toLowerCase();
  if (view === "sent" || /\/newsletters\/sent\/?$/.test(pathname)) return "sent";
  if (view === "in-progress" || /\/newsletters\/in-progress\/?$/.test(pathname)) {
    return "in-progress";
  }
  return "list";
}

export function studioAudienceDetailHref(
  groupId: string,
  tab: AudienceDetailTab = "contacts",
): string {
  const params = new URLSearchParams();
  params.set("id", groupId.trim());
  if (tab !== "contacts") params.set("tab", tab);
  return `${STUDIO_SUBSCRIBERS_PATH}?${params.toString()}`;
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

/** Newsletter detail tabs — content, publish, recipients, stats, settings. */
export type NewsletterDetailTab = "content" | "publish" | "recipients" | "stats" | "settings";

function newsletterDetailTabQueryParam(
  tab: NewsletterDetailTab,
  status: NewsletterStatus | undefined,
): NewsletterDetailTab | null {
  if (!status || status === "draft") {
    return tab === "content" ? null : tab;
  }
  return tab === "stats" ? null : tab;
}

export function newsletterDetailHref(
  id: string,
  tab: NewsletterDetailTab = "content",
  status?: NewsletterStatus,
): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  const tabParam = newsletterDetailTabQueryParam(tab, status);
  if (tabParam) params.set("tab", tabParam);
  return `/studio/newsletters?${params.toString()}`;
}

export function newsletterDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { newsletterId: string; tab: NewsletterDetailTab | null } | null {
  const newsletterId = searchParams.get("id")?.trim() ?? "";
  if (!newsletterId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  if (!raw) {
    return { newsletterId, tab: null };
  }
  let tab: NewsletterDetailTab = "content";
  if (raw === "publish" || raw === "recipients" || raw === "stats" || raw === "settings") {
    tab = raw;
  } else if (raw === "content") {
    tab = "content";
  } else if (raw === "audience") {
    tab = "recipients";
  }
  return { newsletterId, tab };
}

export const TRIGGER_DETAIL_TABS = ["config", "stats"] as const;

/** Legacy URL segments that resolve to Config. */
export const TRIGGER_DETAIL_LEGACY_CONFIG_TABS = [
  "preview",
  "trigger",
  "settings",
  "content",
] as const;

export type TriggerDetailTab = (typeof TRIGGER_DETAIL_TABS)[number];

export function isTriggerDetailTab(value: string): value is TriggerDetailTab {
  return (TRIGGER_DETAIL_TABS as readonly string[]).includes(value);
}

function isLegacyTriggerConfigTab(value: string): boolean {
  return (TRIGGER_DETAIL_LEGACY_CONFIG_TABS as readonly string[]).includes(value);
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
  tab: TriggerDetailTab | "preview" | "trigger" | "settings" | null | undefined,
  _status?: TriggerStatus,
): TriggerDetailTab {
  if (tab === "preview" || tab === "trigger" || tab === "settings") return "config";
  if (tab) return tab;
  return "config";
}

export function triggerDetailHref(
  id: string,
  tab?: TriggerDetailTab,
  status?: TriggerStatus,
): string {
  const resolved = resolveTriggerDetailTab(tab, status);
  return `/studio/triggers/${encodeTriggerPathId(id)}/${resolved}`;
}

export function triggerContentEditHref(id: string): string {
  return `/studio/triggers/${encodeTriggerPathId(id)}/edit`;
}

export function triggersStatsHref(): string {
  return "/studio/triggers/trigger-stats";
}

export type TriggerPathDetail = {
  triggerId: string;
  tab: TriggerDetailTab | null;
  isEdit: boolean;
};

/** Nested `/studio/triggers/{id}/{config|stats|edit|…}`. */
export function triggerDetailFromPathname(pathname: string): TriggerPathDetail | null {
  const match = pathname.match(/^\/studio\/triggers\/([^/]+)(?:\/([^/]+))?\/?$/);
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
    return { triggerId, tab: "config", isEdit: true };
  }
  if (rawSeg === "activity") {
    return { triggerId, tab: "stats", isEdit: false };
  }
  if (isLegacyTriggerConfigTab(rawSeg)) {
    return { triggerId, tab: "config", isEdit: false };
  }
  if (isTriggerDetailTab(rawSeg)) {
    return { triggerId, tab: rawSeg, isEdit: false };
  }
  return { triggerId, tab: "config", isEdit: false };
}

export function triggerTabFromPathname(pathname: string): TriggerDetailTab {
  const tab = triggerDetailFromPathname(pathname)?.tab;
  return tab ?? "config";
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
  let tab: TriggerDetailTab = "config";
  if (raw === "activity") {
    tab = "stats";
  } else if (raw === "content" || raw === "preview" || raw === "trigger" || raw === "settings") {
    tab = "config";
  } else if (isTriggerDetailTab(raw)) {
    tab = raw;
  }
  return { triggerId, tab };
}
