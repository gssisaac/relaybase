"use client";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SettingsAdminTokenPage } from "@/dashboard/components/settings/SettingsAdminTokenPage";
import { SettingsCloudflarePage } from "@/dashboard/components/settings/SettingsCloudflarePage";
import { SettingsConnectionProvider } from "@/dashboard/components/settings/SettingsConnectionContext";
import { SettingsD1Page } from "@/dashboard/components/settings/SettingsD1Page";
import { SettingsInboundR2Page } from "@/dashboard/components/settings/SettingsInboundR2Page";
import { SettingsShell } from "@/dashboard/components/settings/SettingsShell";
import { SettingsWorkerPage } from "@/dashboard/components/settings/SettingsWorkerPage";
import type { SettingsTab } from "@/dashboard/paths";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";

function SettingsTabPage({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case "cloudflare":
      return <SettingsCloudflarePage />;
    case "worker":
      return <SettingsWorkerPage />;
    case "admin-token":
      return <SettingsAdminTokenPage />;
    case "inbound-r2":
      return <SettingsInboundR2Page />;
    case "d1":
      return <SettingsD1Page />;
  }
}

function DesktopSettingsRoutes({ tab }: { tab: SettingsTab }) {
  return (
    <SettingsConnectionProvider>
      <SettingsShell tab={tab}>
        <SettingsTabPage tab={tab} />
      </SettingsShell>
    </SettingsConnectionProvider>
  );
}

export function SettingsView({ tab }: { tab: SettingsTab }) {
  const { isDesktop: desktop } = useDesktopChrome();
  const desktopCtx = useOptionalDesktop();

  if (!desktop || !desktopCtx) {
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

  return <DesktopSettingsRoutes tab={tab} />;
}
