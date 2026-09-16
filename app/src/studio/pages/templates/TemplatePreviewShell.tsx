"use client";

import Link from "next/link";
import { Monitor, Pencil, Smartphone } from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { messageTemplateEditHref } from "@/studio/lib/template-paths";
import { TemplateUseActions } from "@/studio/pages/templates/TemplateUseActions";
import { TemplateDetailSidebar } from "@/studio/pages/templates/TemplateDetailSidebar";
import { useTemplateDetail } from "@/studio/pages/templates/TemplateDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export type TemplatePreviewDevice = "desktop" | "mobile";

const TemplatePreviewDeviceContext = createContext<{
  device: TemplatePreviewDevice;
  setDevice: Dispatch<SetStateAction<TemplatePreviewDevice>>;
} | null>(null);

export function useTemplatePreviewDevice() {
  const ctx = useContext(TemplatePreviewDeviceContext);
  if (!ctx) {
    throw new Error("useTemplatePreviewDevice must be used within TemplatePreviewShell");
  }
  return ctx;
}

function TemplatePreviewDeviceToggle() {
  const { device, setDevice } = useTemplatePreviewDevice();

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        size="icon-sm"
        variant={device === "desktop" ? "secondary" : "ghost"}
        aria-label="Desktop preview"
        aria-pressed={device === "desktop"}
        onClick={() => setDevice("desktop")}
      >
        <Monitor className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={device === "mobile" ? "secondary" : "ghost"}
        aria-label="Mobile preview"
        aria-pressed={device === "mobile"}
        onClick={() => setDevice("mobile")}
      >
        <Smartphone className="size-4" />
      </Button>
    </div>
  );
}

export function TemplatePreviewShell({ children }: { children: ReactNode }) {
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { messageTemplateId, template } = useTemplateDetail();
  const [device, setDevice] = useState<TemplatePreviewDevice>("desktop");

  const title =
    template?.name.trim() || template?.subject.trim() || "Untitled template";

  return (
    <TemplatePreviewDeviceContext value={{ device, setDevice }}>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <TemplateDetailSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DesktopTitleBar
            className="gap-2 border-b border-border px-4 py-3"
            end={
              template ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={messageTemplateEditHref(messageTemplateId)} />}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <TemplateUseActions />
                </>
              ) : null
            }
          >
            <div
              className={cn(
                "relative flex min-w-0 flex-1 items-center gap-2 sm:gap-3",
                noDragClassName,
              )}
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
            >
              <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">{title}</h1>
              {template ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="pointer-events-auto">
                    <TemplatePreviewDeviceToggle />
                  </div>
                </div>
              ) : null}
            </div>
          </DesktopTitleBar>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </TemplatePreviewDeviceContext>
  );
}
