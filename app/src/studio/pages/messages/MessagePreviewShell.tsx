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
import { MessageLinkedOwnerBadge } from "@/studio/components/messages/MessageLinkedOwnerBadge";
import { messageEditHref } from "@/studio/lib/message-paths";
import { MessageUseActions } from "@/studio/pages/messages/MessageUseActions";
import { MessageDetailSidebar } from "@/studio/pages/messages/MessageDetailSidebar";
import { useMessageDetail } from "@/studio/pages/messages/MessageDetailContext";
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
    throw new Error("useTemplatePreviewDevice must be used within MessagePreviewShell");
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

export function MessagePreviewShell({ children }: { children: ReactNode }) {
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { messageId, message } = useMessageDetail();
  const [device, setDevice] = useState<TemplatePreviewDevice>("desktop");

  const title =
    message?.name.trim() || message?.subject.trim() || "Untitled message";

  return (
    <TemplatePreviewDeviceContext value={{ device, setDevice }}>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <MessageDetailSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DesktopTitleBar
            className="gap-2 border-b border-border px-4 py-3"
            end={
              message ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={messageEditHref(messageId)} />}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <MessageUseActions />
                </>
              ) : null
            }
          >
            <div
              className={cn(
                "relative flex min-w-0 flex-1 flex-col justify-center gap-1 sm:gap-3",
                noDragClassName,
              )}
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
            >
              <div className="flex min-w-0 items-center gap-2 pr-24 sm:pr-32">
                <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">{title}</h1>
              </div>
              {message?.linkedOwner ? (
                <MessageLinkedOwnerBadge owner={message.linkedOwner} className="w-fit max-w-full" />
              ) : null}
              {message ? (
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
