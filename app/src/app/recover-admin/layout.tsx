"use client";

import type { ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { EnableEmailApiDialogHost } from "@/console/components/setup/use-enable-email-api-dialog";
import { useDesktopChrome } from "@/lib/desktop/shell";

function RecoverShell({ children }: { children: ReactNode }) {
  const { isDesktop, isMacOS } = useDesktopChrome();

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

export default function RecoverAdminLayout({ children }: { children: ReactNode }) {
  return (
    <DesktopShell>
      <EnableEmailApiDialogHost>
        <RecoverShell>{children}</RecoverShell>
      </EnableEmailApiDialogHost>
    </DesktopShell>
  );
}
