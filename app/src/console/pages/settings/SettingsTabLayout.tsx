"use client";

import { usePathname } from "next/navigation";

import { SettingsConnectionProvider } from "@/console/pages/settings/SettingsConnectionContext";
import { SettingsShell } from "@/console/pages/settings/SettingsShell";
import {
  SETTINGS_TABS,
  type SettingsTab,
} from "@/console/lib/paths";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ReactNode } from "react";

function tabFromPathname(pathname: string): SettingsTab {
  // /settings                 → cloudflare
  // /settings/d1              → d1
  // /settings/worker/update   → worker
  // /settings/update          → standalone (no tab)
  if (pathname === "/settings/update") {
    return "cloudflare";
  }
  const match = pathname.match(/^\/settings\/([^/]+)/);
  const seg = match?.[1];
  if (seg && (SETTINGS_TABS as readonly string[]).includes(seg)) {
    return seg as SettingsTab;
  }
  return "cloudflare";
}

function DesktopRequiredFallback() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Cloudflare, Worker, R2, and D1 connection management.
          </p>
        </div>
      </DesktopTitleBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
          <Alert>
            <AlertTitle>Desktop app required</AlertTitle>
            <AlertDescription>
              Connection settings are managed in the Relaybase desktop app
              (stored under ~/.relaybase). Open Settings there to verify
              Cloudflare, your routing Worker, inbound R2, and D1.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}

export function SettingsTabLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tab = tabFromPathname(pathname);
  const { isDesktop: desktop } = useDesktopChrome();
  const desktopCtx = useOptionalDesktop();
  const isStandaloneUpdate = pathname === "/settings/update";

  if (!desktop || !desktopCtx) {
    return <DesktopRequiredFallback />;
  }

  if (isStandaloneUpdate) {
    return <>{children}</>;
  }

  return (
    <SettingsConnectionProvider>
      <SettingsShell tab={tab}>{children}</SettingsShell>
    </SettingsConnectionProvider>
  );
}

export { tabFromPathname };
