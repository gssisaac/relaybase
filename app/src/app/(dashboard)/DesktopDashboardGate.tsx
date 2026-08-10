"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
import { DisableAppTabFocus } from "@/components/layout/DisableAppTabFocus";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { AccountsProvider } from "@/lib/dashboard/AccountsContext";
import { AccountsSyncBridge } from "@/lib/dashboard/AccountsSyncBridge";
import { BroadcastProvider } from "@/lib/dashboard/BroadcastContext";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import {
  DesktopProvider,
  useDesktop,
} from "@/lib/desktop/DesktopContext";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { DomainProgressBanner } from "@/dashboard/components/DomainProgressBanner";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { MailAccountsProvider } from "@/email/components/MailAccountsContext";
import { EmailMailboxProvider } from "@/email/components/EmailMailboxContext";

const LOCAL_OPERATOR_USER_ID = "desktop";

function setupPathFor(credentials: {
  workerUrl?: string;
  adminToken?: string;
} | null): string | null {
  if (!credentials?.workerUrl || !credentials.adminToken) {
    return "/setup/install";
  }
  return null;
}

function DashboardShell({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return (
    <SessionProvider userId={userId}>
      <DomainProvider>
        <AccountsProvider>
          <BroadcastProvider>
            <MailAccountsProvider>
              <AccountsSyncBridge />
              <EmailMailboxProvider>
                <EmailCommandRuntimeProvider>
                  <DisableAppTabFocus />
                  <div className="flex h-svh overflow-hidden bg-background">
                    <Suspense
                      fallback={
                        <aside className="h-full w-56 shrink-0 border-r border-sidebar-border bg-sidebar" />
                      }
                    >
                      <UserSidebar />
                    </Suspense>
                    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <DomainProgressBanner />
                      {children}
                    </main>
                  </div>
                  <GlobalCommandPalette />
                </EmailCommandRuntimeProvider>
              </EmailMailboxProvider>
            </MailAccountsProvider>
          </BroadcastProvider>
        </AccountsProvider>
      </DomainProvider>
    </SessionProvider>
  );
}

function OperatorInner({ children }: { children: ReactNode }) {
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
    credentials?.workerUrl && credentials.adminToken,
  );

  if (!readyToUse) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Opening setup…
      </div>
    );
  }

  return (
    <DashboardShell userId={LOCAL_OPERATOR_USER_ID}>{children}</DashboardShell>
  );
}

/**
 * Single dashboard chrome for every run mode.
 * Credentials come from ~/.relaybase (Tauri) or /api/local-credentials (browser next).
 */
export function DesktopDashboardGate({
  children,
}: {
  children: ReactNode;
  /** Ignored — kept for call-site compatibility during migration. */
  userId?: string;
}) {
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const sync = () => setDesktop(isDesktopRuntime());
    sync();
    const t = window.setTimeout(sync, 50);
    return () => window.clearTimeout(t);
  }, []);

  // Wait one frame so Tauri inject can be detected before choosing shell chrome.
  if (desktop === null) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <DesktopShell>
      <DesktopProvider>
        <OperatorInner>{children}</OperatorInner>
      </DesktopProvider>
    </DesktopShell>
  );
}
