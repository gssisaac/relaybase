"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { EnableEmailApiDialogHost } from "@/console/components/setup/use-enable-email-api-dialog";
import { useAppSession } from "@/lib/desktop/app-session";
import { useDesktopChrome } from "@/lib/desktop/shell";

/** Setup routes that must finish even when a keyring session already exists. */
const SETUP_CONTINUE_PATHS = [
  "/setup",
  "/setup/install",
  "/setup/license",
  "/setup/progress",
  "/setup/connect",
  "/setup/recover-admin",
] as const;

function isSetupContinuePath(pathname: string): boolean {
  return SETUP_CONTINUE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function SetupShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = useAppSession();
  const { isDesktop, isMacOS } = useDesktopChrome();

  useEffect(() => {
    // Leave setup only when the mailbox can actually load (session + Worker).
    // First-time signup/install must not bounce to an empty inbox mid-flow.
    if (isSetupContinuePath(pathname)) {
      return;
    }
    if (store.canShowApp) {
      router.replace("/");
    }
  }, [store, store.canShowApp, router, pathname]);

  if (pathname === "/setup/connect") {
    return children;
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      {isDesktop && isMacOS ? (
        <div aria-hidden className="w-full shrink-0" style={{ height: 28 }} />
      ) : null}
      <DesktopTitleBar className="px-6 py-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">Relaybase</p>
          <p className="text-xs text-muted-foreground">
            Built for your own Cloudflare account
          </p>
        </div>
      </DesktopTitleBar>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain select-none">
        {children}
      </main>
    </div>
  );
}

export default function SetupLayout({ children }: { children: ReactNode }) {
  // DesktopProvider + AppSessionProvider live at the root layout now, so
  // setup and the dashboard shell share one session.
  return (
    <DesktopShell>
      <EnableEmailApiDialogHost>
        <SetupShell>{children}</SetupShell>
      </EnableEmailApiDialogHost>
    </DesktopShell>
  );
}
