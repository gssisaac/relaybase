"use client";

import Link from "next/link";

import {
  studioInsightSectionHref,
  type StudioInsightSection,
} from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

const SECTIONS: { id: StudioInsightSection; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
];

export function StudioInsightSectionNav({
  active,
}: {
  active: StudioInsightSection;
}) {
  return (
    <nav
      className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5"
      aria-label="Studio insight sections"
    >
      {SECTIONS.map((section) => {
        const href = studioInsightSectionHref(section.id);
        const isActive = section.id === active;
        return (
          <Link
            key={section.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
