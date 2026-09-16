"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

/** Detail sub-page title bar — back control + truncated title (matches newsletter detail). */
export function ScaleDetailPageHeader({
  backHref,
  backLabel = "Back",
  title,
  titleNode,
  end,
}: {
  backHref: string;
  backLabel?: string;
  title?: string;
  /** Replaces the default truncated title heading when set. */
  titleNode?: ReactNode;
  end?: ReactNode;
}) {
  const { noDragClassName, isDesktop } = useDesktopChrome();

  return (
    <DesktopTitleBar className="gap-2 px-4 py-3" end={end}>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 sm:gap-3",
          noDragClassName,
        )}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-2 shrink-0"
          nativeButton={false}
          aria-label={backLabel}
          render={<Link href={backHref} />}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        {titleNode ?? (
          <h1 className="min-w-0 shrink truncate text-sm font-semibold">{title}</h1>
        )}
      </div>
    </DesktopTitleBar>
  );
}
