"use client";

import { useRouter, usePathname } from "next/navigation";
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
import { useAppSession } from "@/lib/desktop/AppSessionContext";
import { DomainProgressBanner } from "@/console/components/DomainProgressBanner";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { MailAccountsProvider } from "@/email/components/accounts/MailAccountsContext";
import { EmailMailboxProvider } from "@/email/components/mailbox/EmailMailboxContext";
import { SenderIconProvider } from "@/email/components/sender/SenderIconContext";
import { UnlockView } from "@/console/components/setup/UnlockView";
import { OfferBiometryView } from "@/console/components/setup/OfferBiometryView";
import { TeamLoginView } from "@/console/components/setup/TeamLoginView";
import { BootScreen } from "@/console/components/setup/BootScreen";

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
  const router = useRouter();
  const phase = store.phase;

  // When the welcome choice is selected, route to the setup page so the
  // install flow owns its own chrome. The store stays the source of truth
  // for "can the dashboard render".
  if (phase.kind === "choice") {
    if (typeof window !== "undefined" && window.location.pathname !== "/setup") {
      // Defer the redirect so we don't navigate during render.
      queueMicrotask(() => {
        if (window.location.pathname !== "/setup") router.replace("/setup");
      });
    }
    return <BootScreen />;
  }

  switch (phase.kind) {
    case "boot":
      return <BootScreen />;
    case "invitedLogin":
      return <TeamLoginView />;
    case "offerBiometry":
      return <OfferBiometryView role={phase.role} />;
    case "unlock":
      return <UnlockView role={phase.role} mode={phase.mode} />;
    case "invitedReady":
      return (
        <DashboardShell userId={store.teamStatus?.accountEmail ?? "team"} teamMode>
          {children}
        </DashboardShell>
      );
    case "ownerReady":
      return (
        <DashboardShell userId={LOCAL_OPERATOR_USER_ID}>{children}</DashboardShell>
      );
    case "install":
    case "ownerRecover":
      // Install / recover own their own chrome under /setup; if we land here
      // outside /setup, bounce there. The setup layout renders the steps.
      if (typeof window !== "undefined" && window.location.pathname !== "/setup") {
        queueMicrotask(() => {
          if (window.location.pathname !== "/setup") router.replace("/setup");
        });
      }
      return <BootScreen />;
    default:
      return <BootScreen />;
  }
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
