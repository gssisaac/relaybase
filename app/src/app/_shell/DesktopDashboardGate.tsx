"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";

import { AppHotkeys } from "@/components/layout/AppHotkeys";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { AppShellFrame } from "@/components/layout/app-shell-nav";
import { DisableAppTabFocus } from "@/components/layout/DisableAppTabFocus";
import { ConsoleAppProviders, WebConsoleAppProviders } from "@/mail-platform/runtime";
import { AccountsProvider } from "@/lib/dashboard/AccountsContext";
import { AccountsSyncBridge } from "@/lib/dashboard/AccountsSyncBridge";
import { BroadcastProvider } from "@/lib/dashboard/BroadcastContext";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SendingHealthProvider } from "@/lib/dashboard/SendingHealthContext";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { EnableEmailApiDialogHost } from "@/console/components/setup/use-enable-email-api-dialog";
import { ConsoleRouteGate } from "@/console/components/setup/ConsoleRouteGate";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";
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
const WEB_OWNER_USER_ID = "web-owner";

/** Console-scoped dashboard stores — mount only after the route gate passes. */
function OwnerConsoleDashboard({ children }: { children: ReactNode }) {
  return (
    <AccountsProvider>
      <BroadcastProvider>
        <AccountsSyncBridge />
        {children}
      </BroadcastProvider>
    </AccountsProvider>
  );
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
  const isEmailSettings =
    pathname === "/email/settings" || pathname.startsWith("/email/settings?");

  if (teamMode) {
    return (
      <SessionProvider userId={userId}>
        <DomainProvider>
          <SendingHealthProvider>
          <MailAccountsProvider>
            <SenderIconProvider>
              <EmailMailboxProvider>
                <EmailCommandRuntimeProvider>
                  <DisableAppTabFocus />
                  <AppShellFrame teamMode hideSidebar={isEmailSettings}>
                    {children}
                  </AppShellFrame>
                  <AppHotkeys />
                  <GlobalCommandPalette />
                </EmailCommandRuntimeProvider>
              </EmailMailboxProvider>
            </SenderIconProvider>
          </MailAccountsProvider>
          </SendingHealthProvider>
        </DomainProvider>
      </SessionProvider>
    );
  }
  return (
    <SessionProvider userId={userId}>
      <DomainProvider>
        <SendingHealthProvider>
        <MailAccountsProvider>
          <SenderIconProvider>
            <EmailMailboxProvider>
              <EmailCommandRuntimeProvider>
                <DisableAppTabFocus />
                <AppShellFrame hideSidebar={isEmailSettings}>
                  <ConsoleRouteGate>
                    <OwnerConsoleDashboard>
                      {isEmailSettings ? null : <DomainProgressBanner />}
                      {children}
                    </OwnerConsoleDashboard>
                  </ConsoleRouteGate>
                </AppShellFrame>
                <AppHotkeys />
                <GlobalCommandPalette />
              </EmailCommandRuntimeProvider>
            </EmailMailboxProvider>
          </SenderIconProvider>
        </MailAccountsProvider>
        </SendingHealthProvider>
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
 * Web owner: no keyring / Touch ID phase machine — `hasWebOwnerSession()`
 * (in-memory access token from `ownerLogin()`, see AccountLoginView /
 * WebInstallFlow) is the whole gate. Reuses the same DashboardShell as
 * desktop's owner path, just under WebConsoleAppProviders instead of
 * DesktopShell + ConsoleAppProviders.
 */
function WebOwnerGate({ children }: { children: ReactNode }) {
  return (
    <WebConsoleAppProviders>
      <DashboardShell userId={WEB_OWNER_USER_ID}>{children}</DashboardShell>
    </WebConsoleAppProviders>
  );
}

/**
 * Single dashboard chrome for every run mode. The phase switch is the only
 * gate — no scattered `hasOwnerSession()` / `ownerAccess` checks. Credentials
 * come from the root `DesktopProvider` (see `AppProviders`).
 */
type DashboardGateMode = "loading" | "desktop" | "web-owner" | "web-redirect";

export function DesktopDashboardGate({
  children,
}: {
  children: ReactNode;
  /** Ignored — kept for call-site compatibility during migration. */
  userId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [gateMode, setGateMode] = useState<DashboardGateMode>("loading");

  useEffect(() => {
    const desktop = isDesktopRuntime();
    if (desktop) {
      setGateMode("desktop");
      return;
    }
    if (hasWebOwnerSession()) {
      setGateMode("web-owner");
      return;
    }
    setGateMode("web-redirect");
  }, []);

  useEffect(() => {
    if (gateMode !== "web-redirect") return;
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    if (pathname === "/email/inbox" || pathname === "/email") {
      router.replace(`/inbox${search}`);
    } else if (pathname === "/email/sent") {
      router.replace(`/sent${search}`);
    } else if (pathname === "/email/drafts") {
      router.replace(`/drafts${search}`);
    } else if (pathname === "/email/trash") {
      router.replace(`/trash${search}`);
    } else if (pathname === "/email/compose") {
      router.replace(`/compose${search}`);
    } else if (pathname === "/email/settings") {
      router.replace(`/mail-settings${search}`);
    } else {
      const auth = getWebTeamAuth();
      if (auth) {
        router.replace(`/inbox${search}`);
      } else {
        router.replace("/setup");
      }
    }
  }, [gateMode, pathname, router]);

  if (gateMode === "loading" || gateMode === "web-redirect") {
    return <AppLoadingScreen />;
  }

  if (gateMode === "web-owner") {
    return <WebOwnerGate>{children}</WebOwnerGate>;
  }

  return (
    <DesktopShell>
      <ConsoleAppProviders>
        <EnableEmailApiDialogHost>
          <GateInner>{children}</GateInner>
        </EnableEmailApiDialogHost>
      </ConsoleAppProviders>
    </DesktopShell>
  );
}
