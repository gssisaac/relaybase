"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  KeyRound,
  Mail,
  Palette,
  ScrollText,
  Settings,
} from "lucide-react";

import {
  EMAIL_SENDER_API,
  EMAIL_SENDER_SERVICE_BASE,
} from "@/relaybase/components/constants";

export function useEmailSenderPaths() {
  const base = EMAIL_SENDER_SERVICE_BASE;
  const status = `${base}/status`;
  const logs = `${base}/logs`;
  const keys = `${base}/keys`;
  const email = `${base}/email`;
  const compose = `${email}/compose`;
  const settings = `${base}/settings`;
  const branding = `${base}/branding`;

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: status, label: "Status", icon: Activity },
    { href: logs, label: "Logs", icon: ScrollText },
    { href: keys, label: "API Keys", icon: KeyRound },
    { href: branding, label: "Branding", icon: Palette },
    { href: email, label: "Email", icon: Mail },
    { href: settings, label: "Settings", icon: Settings },
  ];

  return {
    apiBase: EMAIL_SENDER_API,
    base,
    status,
    logs,
    keys,
    email,
    compose,
    settings,
    branding,
    tabs,
  };
}
