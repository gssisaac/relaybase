"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { AutomationStatusBadge } from "@/scale/components/AutomationStatusBadge";
import { automationContentEditHref, automationDetailHref } from "@/scale/lib/paths";
import { AutomationContentView } from "@/scale/pages/automations/AutomationContentView";
import { AutomationDetailProvider } from "@/scale/pages/automations/AutomationDetailContext";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export function AutomationContentEditInner() {
  const { automationId, automation, loading, notFound } = useAutomationDetail();
  const { noDragClassName, isDesktop } = useDesktopChrome();

  const title =
    automation?.name?.trim() ||
    automation?.subject?.trim() ||
    (notFound ? "Automation not found" : "Untitled automation");

  const backHref = automation
    ? automationDetailHref(automationId, "preview", automation.status)
    : "/scale/automations";

  if (loading && !automation) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (notFound || !automation) {
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
              render={<Link href="/scale/automations" />}
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
            <h1 className="truncate text-sm font-semibold">Automation not found</h1>
          </div>
        </DesktopTitleBar>
        <div className="p-4 text-sm text-muted-foreground">
          This automation does not exist or was removed.
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
            aria-label="Back to preview"
            render={<Link href={backHref} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <h1 className="min-w-0 shrink truncate text-sm font-semibold">{title}</h1>
            <span className="shrink-0 text-xs text-muted-foreground">Content</span>
            <AutomationStatusBadge
              status={automation.status}
              listStatus={automation.listStatus}
              className="shrink-0"
            />
          </div>
        </div>
      </DesktopTitleBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AutomationContentView />
      </div>
    </div>
  );
}

function AutomationContentEditRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const automationId = searchParams.get("id")?.trim() ?? "";

  useEffect(() => {
    if (!automationId || isDesktopRuntime()) return;
    router.replace(automationContentEditHref(automationId));
  }, [automationId, router]);

  if (!automationId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Missing automation id.{" "}
        <Link href="/scale/automations" className="text-primary underline-offset-4 hover:underline">
          Back to automations
        </Link>
      </div>
    );
  }

  return (
    <AutomationDetailProvider key={automationId} automationId={automationId}>
      <AutomationContentEditInner />
    </AutomationDetailProvider>
  );
}

export function AutomationContentEditView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <AutomationContentEditRoute />
    </Suspense>
  );
}
