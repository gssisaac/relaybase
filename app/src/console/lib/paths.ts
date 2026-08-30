"use client";

import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  Globe,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";

import {
  useProductApiBase,
  useProductHref,
} from "@/lib/dashboard/shared/ProductContext";

/** Dashboard / ops routes (no Emails — mail lives in Email mode). */
export function useDashboardPaths() {
  const apiBase = useProductApiBase("email");
  const base = useProductHref();
  const dashboard = useProductHref("dashboard");
  const domains = useProductHref("domains");
  const keys = useProductHref("keys");
  const logs = useProductHref("logs");
  const accounts = useProductHref("accounts");
  const broadcasts = useProductHref("broadcasts");
  const audience = useProductHref("audience");
  const settingsBase = useProductHref("settings");

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: dashboard, label: "Dashboard", icon: LayoutDashboard },
    { href: domains, label: "Domains", icon: Globe },
    { href: accounts, label: "Accounts", icon: AtSign },
    { href: audience, label: "Audience", icon: Users },
    { href: broadcasts, label: "Broadcasts", icon: Megaphone },
    { href: keys, label: "API Keys", icon: KeyRound },
    { href: logs, label: "Log", icon: ScrollText },
    { href: settingsBase, label: "Settings", icon: Settings },
  ];

  return {
    apiBase,
    base,
    dashboard,
    domains,
    keys,
    logs,
    accounts,
    broadcasts,
    audience,
    settingsBase,
    tabs,
  };
}

export type SettingsTab =
  | "cloudflare"
  | "worker"
  | "inbound-r2"
  | "d1"
  | "mailbox";

const SETTINGS_TABS: SettingsTab[] = [
  "cloudflare",
  "worker",
  "inbound-r2",
  "d1",
  "mailbox",
];

export { SETTINGS_TABS };

export function settingsTabHref(tab: SettingsTab = "cloudflare"): string {
  if (tab === "cloudflare") return "/settings";
  return `/settings/${tab}`;
}

export function settingsTabFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { tab: SettingsTab } | null {
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  if (!raw) return null;
  if (SETTINGS_TABS.includes(raw as SettingsTab)) {
    return { tab: raw as SettingsTab };
  }
  return null;
}

export function settingsTabFromSegment(segment?: string): SettingsTab {
  if (segment && SETTINGS_TABS.includes(segment as SettingsTab)) {
    return segment as SettingsTab;
  }
  return "cloudflare";
}

export type AccountDetailTab =
  | "overview"
  | "logs"
  | "settings"
  | "teammate-login";

export type AudienceDetailTab = "contacts" | "history" | "settings";

export type BroadcastDetailTab =
  | "overview"
  | "audience"
  | "content"
  | "progress";

/**
 * Account detail deep link for static-export-safe navigation.
 * Opens the account sheet on `/accounts` via `?email=` (+ optional `tab`).
 */
export function accountDetailHref(
  email: string,
  tab: AccountDetailTab = "overview",
): string {
  const params = new URLSearchParams();
  params.set("email", email.trim().toLowerCase());
  if (tab !== "overview") params.set("tab", tab);
  return `/accounts?${params.toString()}`;
}

export function accountDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { email: string; tab: AccountDetailTab } | null {
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  // Legacy `other-device` deep links map to teammate-login.
  const tab: AccountDetailTab =
    raw === "logs" || raw === "settings" || raw === "teammate-login"
      ? raw
      : raw === "other-device"
        ? "teammate-login"
        : "overview";
  return { email, tab };
}

/** Audience group detail — `/audience?id=&tab=`. */
export function audienceDetailHref(
  groupId: string,
  tab: AudienceDetailTab = "contacts",
): string {
  const params = new URLSearchParams();
  params.set("id", groupId.trim());
  if (tab !== "contacts") params.set("tab", tab);
  return `/audience?${params.toString()}`;
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

/** Broadcast detail — `/broadcasts?id=&tab=` (list create dialog keeps `?new=1`). */
export function broadcastDetailHref(
  broadcastId: string,
  tab: BroadcastDetailTab = "overview",
): string {
  const params = new URLSearchParams();
  params.set("id", broadcastId.trim());
  if (tab !== "overview") params.set("tab", tab);
  return `/broadcasts?${params.toString()}`;
}

export function broadcastDetailFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { broadcastId: string; tab: BroadcastDetailTab } | null {
  const broadcastId = searchParams.get("id")?.trim() ?? "";
  if (!broadcastId) return null;
  const raw = searchParams.get("tab")?.trim().toLowerCase();
  const tab: BroadcastDetailTab =
    raw === "audience" || raw === "content" || raw === "progress"
      ? raw
      : "overview";
  return { broadcastId, tab };
}
