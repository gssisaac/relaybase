"use client";

import { ArrowLeft, Layers, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { MacDesktopTitlebarSpacer } from "@/components/layout/MacDesktopTitlebarSpacer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signOutHqStudio } from "@/lib/desktop/auth";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { useStudioPaths } from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { segment: "account", label: "Account", icon: UserRound, hrefSuffix: "" },
  { segment: "layouts", label: "Layouts", icon: Layers, hrefSuffix: "/layouts" },
] as const;

function settingsSectionFromPathname(pathname: string): (typeof SETTINGS_NAV)[number]["segment"] {
  if (pathname.startsWith("/studio/settings/layouts")) return "layouts";
  return "account";
}

export function StudioSettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dashboard, settings } = useStudioPaths();
  const activeSection = settingsSectionFromPathname(pathname);
  const { dragRegionProps, dragRegionClassName, noDragClassName } = useDesktopChrome();

  async function handleSignOut() {
    await signOutHqStudio();
    router.replace("/studio/login");
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        {...dragRegionProps}
        className={cn(
          "flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          dragRegionClassName,
        )}
      >
        <MacDesktopTitlebarSpacer />

        <div
          className={cn("shrink-0 px-2 pb-2 pt-1", noDragClassName)}
          {...(dragRegionProps ? { "data-tauri-drag-region": "false" } : {})}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => router.push(dashboard)}
          >
            <ArrowLeft className="size-3.5" />
            Back to Studio
          </Button>
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5 overflow-y-auto p-2",
            noDragClassName,
          )}
          aria-label="Studio settings"
          {...(dragRegionProps ? { "data-tauri-drag-region": "false" } : {})}
        >
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const href = `${settings}${item.hrefSuffix}`;
            const active = item.segment === activeSection;
            return (
              <Link
                key={item.segment}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "shrink-0 border-t border-sidebar-border p-2",
            noDragClassName,
          )}
          {...(dragRegionProps ? { "data-tauri-drag-region": "false" } : {})}
        >
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                />
              }
            >
              <LogOut className="size-3.5" />
              Sign out of Studio
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of Relaybase Studio?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ends your Studio cloud session on this device.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleSignOut()}>
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
