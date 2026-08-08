"use client";

import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  BarChart3,
  Globe,
  KeyRound,
  LayoutDashboard,
  Megaphone,
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
  const accounts = useProductHref("accounts");
  const broadcasts = useProductHref("broadcasts");
  const audience = useProductHref("audience");
  const metrics = useProductHref("metrics");
  const settingsBase = useProductHref("settings");
  /** @deprecated Use `keys` — legacy settings route */
  const settingsKeys = useProductHref("settings", "keys");
  const settingsDomain = useProductHref("settings", "domain");
  /** @deprecated Use settingsKeys — legacy route alias */
  const settingsCloudflare = useProductHref("settings", "aws");

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: dashboard, label: "Dashboard", icon: LayoutDashboard },
    { href: domains, label: "Domains", icon: Globe },
    { href: keys, label: "API Keys", icon: KeyRound },
    { href: accounts, label: "Accounts", icon: AtSign },
    { href: broadcasts, label: "Broadcasts", icon: Megaphone },
    { href: audience, label: "Audience", icon: Users },
    { href: metrics, label: "Metrics", icon: BarChart3 },
    { href: settingsBase, label: "Settings", icon: Settings },
  ];

  const settingsNav = [{ href: settingsDomain, label: "Domain" }] as const;

  return {
    apiBase,
    base,
    dashboard,
    domains,
    keys,
    accounts,
    broadcasts,
    audience,
    metrics,
    settingsBase,
    settingsKeys,
    settingsCloudflare,
    settingsDomain,
    tabs,
    settingsNav,
  };
}
