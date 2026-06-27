"use client";

import type { LucideIcon } from "lucide-react";
import { KeyRound, Mail, Palette, ScrollText, Settings } from "lucide-react";

import {
  RELAYBASE_API,
  RELAYBASE_SERVICE_BASE,
} from "@/relaybase/components/constants";

export function useRelaybasePaths() {
  const base = RELAYBASE_SERVICE_BASE;
  const status = `${base}/status`;
  const logs = `${base}/logs`;
  const keys = `${base}/keys`;
  const email = `${base}/email`;
  const compose = `${email}/compose`;
  const settings = `${base}/settings`;
  const branding = `${base}/branding`;

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: logs, label: "Logs", icon: ScrollText },
    { href: keys, label: "API Keys", icon: KeyRound },
    { href: branding, label: "Branding", icon: Palette },
    { href: email, label: "Email", icon: Mail },
    { href: settings, label: "Settings", icon: Settings },
  ];

  return {
    apiBase: RELAYBASE_API,
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

/** @deprecated Use useRelaybasePaths */
export const useEmailSenderPaths = useRelaybasePaths;
