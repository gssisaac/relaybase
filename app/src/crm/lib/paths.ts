"use client";

import type { LucideIcon } from "lucide-react";
import { Kanban, Mail, Users } from "lucide-react";

/** CRM mode routes — mirrors `console/lib/paths.ts`'s `useDashboardPaths()`. */
export function useCrmPaths() {
  const base = "/crm";
  const contacts = "/crm/contacts";
  const pipeline = "/crm/pipeline";
  const campaigns = "/crm/campaigns";

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [
    { href: contacts, label: "Contacts", icon: Users },
    { href: pipeline, label: "Pipeline", icon: Kanban },
    { href: campaigns, label: "Campaigns", icon: Mail },
  ];

  return { base, contacts, pipeline, campaigns, tabs };
}
