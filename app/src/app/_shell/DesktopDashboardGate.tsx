"use client";

import { useRouter, usePathname } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

import { AppHotkeys } from "@/components/layout/AppHotkeys";
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
import { DomainProgressBanner } from "@/console/components/DomainProgressBanner";
import { WorkerUpdateBanner } from "@/console/components/WorkerUpdateBanner";
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
  adminToken?: string;
  relaybaseSession?: string;
} | null): string | null {
  // Install-first: a Relaybase console account is optional and can be added
  // later from Settings (for license + ADMIN_TOKEN recovery). The only setup
  // gate is a connected Worker. New users land on the /setup choice screen
  // (Install on my Cloudflare / I was invited) rather than the login page.
  if (!credentials?.workerUrl || !credentials.adminToken) {
    return "/setup";
  }
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
                        {isEmailSettings ? null : <WorkerUpdateBanner />}
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

  useEffect(() => {
    if (!ready) return;
    // Team users (per-account mobile password) skip the admin/account setup
    // path entirely — they render the email-only shell below.
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

  // Team user: email-only mode (no admin token, no management console).
  if (teamLogin) {
    return (
      <DashboardShell userId={teamLogin.accountEmail} teamMode>
        {children}
      </DashboardShell>
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
  return (
    <DesktopShell>
      <DesktopProvider>
        <OperatorInner>{children}</OperatorInner>
      </DesktopProvider>
    </DesktopShell>
  );
}
