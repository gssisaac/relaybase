"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

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
import { useAppSession } from "@/lib/desktop/app-session";
import { DomainProgressBanner } from "@/console/components/DomainProgressBanner";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { MailAccountsProvider } from "@/email/components/accounts/MailAccountsContext";
import { EmailMailboxProvider } from "@/email/components/mailbox/EmailMailboxContext";
import { SenderIconProvider } from "@/email/components/sender/SenderIconContext";
import { SessionPhaseScreen } from "@/console/components/setup/SessionPhaseScreen";

const LOCAL_OPERATOR_USER_ID = "desktop";

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
  const isEmailSettings =
    pathname === "/email/settings" || pathname.startsWith("/email/settings?");

  if (teamMode) {
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

function GateInner({ children }: { children: ReactNode }) {
  const store = useAppSession();
  return (
    <SessionPhaseScreen>
      {(role) =>
        role === "invited" ? (
          <DashboardShell
            userId={store.teamStatus?.accountEmail ?? "team"}
            teamMode
          >
            {children}
          </DashboardShell>
        ) : (
          <DashboardShell userId={LOCAL_OPERATOR_USER_ID}>
            {children}
          </DashboardShell>
        )
      }
    </SessionPhaseScreen>
  );
}

/**
 * Single dashboard chrome for every run mode. The phase switch is the only
 * gate — no scattered `hasOwnerSession()` / `ownerAccess` checks. Credentials
 * come from the root `DesktopProvider` (see `AppProviders`).
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
      <EnableEmailApiDialogHost>
        <GateInner>{children}</GateInner>
      </EnableEmailApiDialogHost>
    </DesktopShell>
  );
}
