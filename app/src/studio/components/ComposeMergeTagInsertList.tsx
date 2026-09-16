"use client";

import { Button } from "@/components/ui/button";
import type { ComposeMergeTagSection } from "@/studio/lib/triggers/trigger-merge-tags";

export function ComposeMergeTagInsertList({
  sections,
  onInsert,
  compact,
}: {
  sections: ComposeMergeTagSection[];
  onInsert: (token: string) => void;
  /** Tighter spacing for subject-line popover. */
  compact?: boolean;
}) {
  if (!sections.some((s) => s.tags.length)) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {sections.map((section) =>
        section.tags.length ? (
          <div key={section.title}>
            <p
              className={
                compact
                  ? "mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  : "mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              }
            >
              {section.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.tags.map((tag) => (
                <li key={tag.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 px-2 py-1.5 font-normal"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onInsert(tag.token)}
                  >
                    <code className="shrink-0 text-xs">{tag.token}</code>
                    <span className="truncate text-xs text-muted-foreground">{tag.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}
