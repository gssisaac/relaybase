"use client";

import { LayoutGrid, Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type StudioGalleryViewMode = "card" | "table";

export function StudioGalleryViewToggle({
  value,
  onChange,
}: {
  value: StudioGalleryViewMode;
  onChange: (value: StudioGalleryViewMode) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-lg bg-muted p-0.5">
      <button
        type="button"
        aria-label="Card view"
        aria-pressed={value === "card"}
        onClick={() => onChange("card")}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
          value === "card"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
          value === "table"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Table2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
