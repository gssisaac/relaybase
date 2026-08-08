"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { UserSidebar } from "@/components/layout/UserSidebar";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import {
  DesktopProvider,
  useDesktop,
} from "@/lib/desktop/DesktopContext";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { DomainProgressBanner } from "@/relaybase-email/components/DomainProgressBanner";

function setupPathFor(credentials: {
  accountId?: string;
  apiToken?: string;
  workerUrl?: string;
  adminToken?: string;
  licenseKey?: string;
} | null): string | null {
  if (!credentials?.accountId || !credentials.apiToken) {
    return "/setup/connect";
  }
  if (!credentials.workerUrl || !credentials.adminToken) {
    return "/setup/install";
  }
  if (!credentials.licenseKey) {
    return "/setup/license";
  }
  return null;
}

function DesktopInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, credentials } = useDesktop();

  useEffect(() => {
    if (!ready) return;
    const path = setupPathFor(credentials);
    if (path) router.replace(path);
  }, [ready, credentials, router]);

  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const readyToUse = Boolean(
    credentials?.workerUrl && credentials.adminToken && credentials.licenseKey,
  );

  if (!readyToUse) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Opening setup…
      </div>
    );
  }

  return (
    <SessionProvider userId="desktop">
      <DomainProvider>
        <div className="flex h-svh overflow-hidden bg-background">
          <UserSidebar />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DomainProgressBanner />
            {children}
          </main>
        </div>
      </DomainProvider>
    </SessionProvider>
  );
}

/**
 * When running inside Tauri, skip cookie auth and use local ~/.relaybase credentials.
 * When running in the browser (next dev), children are rendered by the server layout.
 */
export function DesktopDashboardGate({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isDesktopRuntime());
  }, []);

  if (!desktop) {
    return <>{children}</>;
  }

  return (
    <DesktopProvider>
      <DesktopInner>{children}</DesktopInner>
    </DesktopProvider>
  );
}
