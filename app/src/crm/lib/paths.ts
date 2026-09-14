"use client";

import type { LucideIcon } from "lucide-react";
import { Users } from "lucide-react";

/** CRM mode routes — mirrors `console/lib/paths.ts`'s `useDashboardPaths()`. */
export function useCrmPaths() {
  const base = "/crm";
  const contacts = "/crm";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: contacts, label: "Contacts", icon: Users },
  ];

  return { base, contacts, tabs };
}
