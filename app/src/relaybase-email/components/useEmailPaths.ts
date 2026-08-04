"use client";

import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  BarChart3,
  Globe,
  KeyRound,
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
  const keys = usePanelHref("keys");
  const emails = usePanelHref("emails");
  const inbox = usePanelHref("emails", "inbox");
  const sent = usePanelHref("emails", "sent");
  const compose = usePanelHref("emails", "compose");
  const settingsBase = usePanelHref("settings");
  /** @deprecated Use `keys` — legacy settings route */
  const settingsKeys = usePanelHref("settings", "keys");
  const settingsDomain = usePanelHref("settings", "domain");
  /** @deprecated Use settingsKeys — legacy route alias */
  const settingsCloudflare = usePanelHref("settings", "aws");

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: dashboard, label: "Dashboard", icon: LayoutDashboard },
    { href: domains, label: "Domains", icon: Globe },
    { href: keys, label: "API Keys", icon: KeyRound },
    { href: usePanelHref("accounts"), label: "Accounts", icon: AtSign },
    { href: emails, label: "Emails", icon: Mail },
    { href: usePanelHref("broadcasts"), label: "Broadcasts", icon: Megaphone },
    { href: usePanelHref("audience"), label: "Audience", icon: Users },
    { href: usePanelHref("metrics"), label: "Metrics", icon: BarChart3 },
    { href: settingsBase, label: "Settings", icon: Settings },
  ];

  const settingsNav = [
    { href: settingsDomain, label: "Domain" },
  ] as const;

  return {
    apiBase,
    base,
    dashboard,
    domains,
    keys,
    emails,
    inbox,
    sent,
    compose,
    settingsBase,
    settingsKeys,
    settingsCloudflare,
    settingsDomain,
    tabs,
    settingsNav,
  };
}
