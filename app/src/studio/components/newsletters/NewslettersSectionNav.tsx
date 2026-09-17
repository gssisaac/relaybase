"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, Clock, Mail } from "lucide-react";
import Link from "next/link";

import {
  newslettersSectionHref,
  type NewslettersSection,
} from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

const SECTIONS: { id: NewslettersSection; label: string; icon: LucideIcon }[] = [
  { id: "list", label: "Newsletters", icon: Mail },
  { id: "sent", label: "Sent", icon: BarChart3 },
  { id: "in-progress", label: "In progress", icon: Clock },
];

export function NewslettersSectionNav({
  active,
}: {
  active: NewslettersSection;
}) {
  return (
    <nav
      className="flex shrink-0 gap-0.5 overflow-x-auto"
      aria-label="Newsletter sections"
    >
      {SECTIONS.map((section) => {
        const href = newslettersSectionHref(section.id);
        const isActive = section.id === active;
        const Icon = section.icon;
        return (
          <Link
            key={section.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
