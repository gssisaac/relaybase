"use client";

import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { TemplateUseActions } from "@/scale/pages/templates/TemplateUseActions";
import { TemplateDetailSidebar } from "@/scale/pages/templates/TemplateDetailSidebar";
import { useTemplateDetail } from "@/scale/pages/templates/TemplateDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export function TemplatePreviewShell({ children }: { children: ReactNode }) {
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { template } = useTemplateDetail();

  const title =
    template?.name.trim() || template?.subject.trim() || "Untitled template";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <TemplateDetailSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar
          className="gap-2 px-4 py-3"
          end={template ? <TemplateUseActions /> : null}
        >
          <div
            className={cn("flex min-w-0 flex-1 items-center gap-2 sm:gap-3", noDragClassName)}
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">{title}</h1>
          </div>
        </DesktopTitleBar>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
