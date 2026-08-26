"use client";

import { useRouter, usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { AppHotkeys } from "@/components/layout/AppHotkeys";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { DisableAppTabFocus } from "@/components/layout/DisableAppTabFocus";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { AccountsProvider } from "@/lib/dashboard/AccountsContext";
import { AccountsSyncBridge } from "@/lib/dashboard/AccountsSyncBridge";
import { BroadcastProvider } from "@/lib/dashboard/BroadcastContext";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { EnableEmailApiDialogHost } from "@/console/components/setup/use-enable-email-api-dialog";
import { OwnerUnlockPanel } from "@/console/components/setup/OwnerUnlockPanel";
import {
  DesktopProvider,
  useDesktop,
} from "@/lib/desktop/DesktopContext";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { hasOwnerSession } from "@/lib/desktop/owner-session";
import { DomainProgressBanner } from "@/console/components/DomainProgressBanner";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { MailAccountsProvider } from "@/email/components/accounts/MailAccountsContext";
import { EmailMailboxProvider } from "@/email/components/mailbox/EmailMailboxContext";
import { SenderIconProvider } from "@/email/components/sender/SenderIconContext";

const LOCAL_OPERATOR_USER_ID = "desktop";

function setupPathFor(credentials: {
  workerUrl?: string;
} | null): string | null {
  // Install-first: a Relaybase console account is optional. The gate is a
  // Worker URL. Desktop then unlocks via Touch ID / Windows Hello (keyring);
  // browser `pnpm next` uses the in-memory owner session.
  if (!credentials?.workerUrl) return "/setup";
  if (!isDesktopRuntime() && !hasOwnerSession()) return "/setup/connect";
  return null;
}

function DashboardShell({
  userId,
  teamMode = false,
  children,
}: {
  userId: string;
  teamMode?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Email settings is a fullscreen takeover: it renders its own side area
  // (with macOS traffic-light inset + back button) and hides the main app
  // sidebar so it can occupy the whole window.
  const isEmailSettings =
    pathname === "/email/settings" || pathname.startsWith("/email/settings?");

  if (teamMode) {
    // Email-only shell for team users. They get the same Email sidebar as the
    // admin operator (Add account, Settings, folder tree) but no dashboard
    // switch — team mode is locked to email. The full /mobile/* routing is
    // wired in the email views; this shell keeps them out of admin pages.
    return (
      <SessionProvider userId={userId}>
        <DomainProvider>
          <MailAccountsProvider>
            <SenderIconProvider>
              <EmailMailboxProvider>
                <EmailCommandRuntimeProvider>
                  <DisableAppTabFocus />
                  <div className="flex h-svh overflow-hidden bg-background">
                    {isEmailSettings ? null : (
                      <Suspense
                        fallback={
                          <aside className="h-full w-56 shrink-0 border-r border-sidebar-border bg-sidebar" />
                        }
                      >
                        <UserSidebar teamMode />
                      </Suspense>
                    )}
                    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      {children}
                    </main>
                  </div>
                  <AppHotkeys />
                  <GlobalCommandPalette />
                </EmailCommandRuntimeProvider>
              </EmailMailboxProvider>
            </SenderIconProvider>
          </MailAccountsProvider>
        </DomainProvider>
      </SessionProvider>
    );
  }
  return (
    <SessionProvider userId={userId}>
      <DomainProvider>
        <AccountsProvider>
          <BroadcastProvider>
            <MailAccountsProvider>
              <AccountsSyncBridge />
              <SenderIconProvider>
                <EmailMailboxProvider>
                  <EmailCommandRuntimeProvider>
                    <DisableAppTabFocus />
                    <div className="flex h-svh overflow-hidden bg-background">
                      {isEmailSettings ? null : (
                        <Suspense
                          fallback={
                            <aside className="h-full w-56 shrink-0 border-r border-sidebar-border bg-sidebar" />
                          }
                        >
                          <UserSidebar />
                        </Suspense>
                      )}
                      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        {isEmailSettings ? null : <DomainProgressBanner />}
                        {children}
                      </main>
                    </div>
                    <AppHotkeys />
                    <GlobalCommandPalette />
                  </EmailCommandRuntimeProvider>
                </EmailMailboxProvider>
              </SenderIconProvider>
            </MailAccountsProvider>
          </BroadcastProvider>
        </AccountsProvider>
      </DomainProvider>
    </SessionProvider>
  );
}

function OperatorInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, credentials, teamLogin } = useDesktop();
  const [ownerReady, setOwnerReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (teamLogin) return;
    const path = setupPathFor(credentials);
    if (path) router.replace(path);
  }, [ready, credentials, teamLogin, router]);

  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (teamLogin) {
    return (
      <DashboardShell userId={teamLogin.accountEmail} teamMode>
        {children}
      </DashboardShell>
    );
  }

  const workerUrl = credentials?.workerUrl?.trim() ?? "";
  if (!workerUrl) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Opening setup…
      </div>
    );
  }

  if (isDesktopRuntime() && !ownerReady) {
    return (
      <OwnerUnlockPanel
        workerUrl={workerUrl}
        onUnlocked={() => setOwnerReady(true)}
      />
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
  return (
    <DesktopShell>
      <DesktopProvider>
        <EnableEmailApiDialogHost>
          <OperatorInner>{children}</OperatorInner>
        </EnableEmailApiDialogHost>
      </DesktopProvider>
    </DesktopShell>
  );
}
