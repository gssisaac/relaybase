"use client";

import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  BarChart3,
  Globe,
  LayoutDashboard,
  Mail,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";

import {
  usePanelHref,
  useProductApiBase,
} from "@/lib/dashboard/shared/ProductContext";

export function useEmailPaths() {
  const apiBase = useProductApiBase("email");
  const base = usePanelHref();
  const dashboard = usePanelHref("dashboard");
  const domains = usePanelHref("domains");
  const emails = usePanelHref("emails");
  const compose = usePanelHref("emails", "compose");
  const settingsBase = usePanelHref("settings");
  const settingsKeys = usePanelHref("settings", "keys");
  const settingsDomain = usePanelHref("settings", "domain");
  /** @deprecated Use settingsKeys — legacy route alias */
  const settingsCloudflare = usePanelHref("settings", "aws");

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: dashboard, label: "Dashboard", icon: LayoutDashboard },
    { href: domains, label: "Domains", icon: Globe },
    { href: usePanelHref("accounts"), label: "Accounts", icon: AtSign },
    { href: emails, label: "Emails", icon: Mail },
    { href: usePanelHref("broadcasts"), label: "Broadcasts", icon: Megaphone },
    { href: usePanelHref("audience"), label: "Audience", icon: Users },
    { href: usePanelHref("metrics"), label: "Metrics", icon: BarChart3 },
    { href: settingsBase, label: "Settings", icon: Settings },
  ];

  const settingsNav = [
    { href: settingsKeys, label: "API Keys" },
    { href: settingsDomain, label: "Domain" },
  ] as const;

  return {
    apiBase,
    base,
    dashboard,
    domains,
    emails,
    compose,
    settingsBase,
    settingsKeys,
    settingsCloudflare,
    settingsDomain,
    tabs,
    settingsNav,
  };
}
