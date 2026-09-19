"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { TriggerStatusBadge } from "@/studio/components/triggers/TriggerStatusBadge";
import { triggerContentEditHref, triggerDetailHref } from "@/studio/lib/paths";
import { TriggerContentView } from "@/studio/pages/triggers/TriggerContentView";
import { TriggerDetailProvider } from "@/studio/pages/triggers/TriggerDetailContext";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export function TriggerContentEditInner() {
  const { triggerId, trigger, loading, notFound } = useTriggerDetail();
  const { noDragClassName, isDesktop } = useDesktopChrome();

  const title =
    trigger?.name?.trim() ||
    trigger?.subject?.trim() ||
    (notFound ? "Trigger not found" : "Untitled trigger");

  const backHref = trigger
    ? triggerDetailHref(triggerId, "config", trigger.status)
    : "/studio/triggers";

  if (loading && !trigger) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (notFound || !trigger) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="-ml-2"
              nativeButton={false}
              aria-label="Back"
              render={<Link href="/studio/triggers" />}
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
            <h1 className="truncate text-sm font-semibold">Trigger not found</h1>
          </div>
        </DesktopTitleBar>
        <div className="p-4 text-sm text-muted-foreground">
          This trigger does not exist or was removed.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="gap-2 px-4 py-3">
        <div
          className={cn("flex min-w-0 flex-1 items-center gap-2 sm:gap-3", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2 shrink-0"
            nativeButton={false}
            aria-label="Back to config"
            render={<Link href={backHref} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <h1 className="min-w-0 shrink truncate text-sm font-semibold">{title}</h1>
            <span className="shrink-0 text-xs text-muted-foreground">Content</span>
            <TriggerStatusBadge
              status={trigger.status}
              listStatus={trigger.listStatus}
              className="shrink-0"
            />
          </div>
        </div>
      </DesktopTitleBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TriggerContentView />
      </div>
    </div>
  );
}

function TriggerContentEditRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggerId = searchParams.get("id")?.trim() ?? "";

  useEffect(() => {
    if (!triggerId || isDesktopRuntime()) return;
    router.replace(triggerContentEditHref(triggerId));
  }, [triggerId, router]);

  if (!triggerId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Missing trigger id.{" "}
        <Link href="/studio/triggers" className="text-primary underline-offset-4 hover:underline">
          Back to triggers
        </Link>
      </div>
    );
  }

  return (
    <TriggerDetailProvider key={triggerId} triggerId={triggerId}>
      <TriggerContentEditInner />
    </TriggerDetailProvider>
  );
}

export function TriggerContentEditView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TriggerContentEditRoute />
    </Suspense>
  );
}
