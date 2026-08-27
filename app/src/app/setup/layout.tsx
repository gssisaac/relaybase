"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { EnableEmailApiDialogHost } from "@/console/components/setup/use-enable-email-api-dialog";
import { useAppSession } from "@/lib/desktop/AppSessionContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";

function SetupShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = useAppSession();
  const { isDesktop, isMacOS } = useDesktopChrome();

  useEffect(() => {
    // The store is the single source of truth for "can the dashboard show".
    // Leave setup once an owner or invited session is ready. Stay on the
    // progress / reveal / recover steps so the user can finish copying the
    // passtoken or re-issuing it.
    if (
      pathname === "/setup/progress" ||
      pathname === "/setup/recover-admin"
    ) {
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
