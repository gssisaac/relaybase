"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { EnableEmailApiDialogHost } from "@/console/components/setup/use-enable-email-api-dialog";
import {
  DesktopProvider,
  useDesktop,
} from "@/lib/desktop/DesktopContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";

function SetupShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, credentials } = useDesktop();
  const { isDesktop, isMacOS } = useDesktopChrome();

  useEffect(() => {
    if (!ready) return;
    // Leave setup once a Worker is connected. A Relaybase console account is
    // optional (added later from Settings for license + ADMIN_TOKEN recovery),
    // so we do not gate the dashboard on relaybaseSession here.
    // Stay on /setup/progress so the user can copy the admin token after install.
    if (pathname === "/setup/progress") return;
    if (credentials?.workerUrl && credentials.adminToken) {
      router.replace("/");
    }
  }, [ready, credentials, router, pathname]);

  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
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
  // Tauri and browser next both load credentials from ~/.relaybase
  // (Tauri invoke vs /api/local-credentials).
  return (
    <DesktopShell>
      <DesktopProvider>
        <EnableEmailApiDialogHost>
          <SetupShell>{children}</SetupShell>
        </EnableEmailApiDialogHost>
      </DesktopProvider>
    </DesktopShell>
  );
}
