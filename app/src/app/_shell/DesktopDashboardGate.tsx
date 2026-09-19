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
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SendingHealthProvider } from "@/lib/dashboard/SendingHealthContext";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { EnableEmailApiDialogHost } from "@/console/components/setup/common/update/use-enable-email-api-dialog";
import { ConsoleRouteGate } from "@/console/components/setup/common/layout/ConsoleRouteGate";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { shouldRedirectToCloudOnboarding } from "@/features/onboarding/lib/needs-cloud-onboarding";
import { ensureWebCloudAuth } from "@/lib/auth/cloud-worker-session";
import { isStudioSettingsPath } from "@/lib/navigation/studio-settings-path";
import { modeFromPathname } from "@/lib/navigation/sidebar-paths";
import { DomainProgressBanner } from "@/console/components/DomainProgressBanner";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { MailAccountsProvider } from "@/email/components/accounts/MailAccountsContext";
import { EmailMailboxProvider } from "@/email/components/mailbox/EmailMailboxContext";
import { SenderIconProvider } from "@/email/components/sender/SenderIconContext";
import { SessionPhaseScreen } from "@/console/components/setup/common/layout/SessionPhaseScreen";

const LOCAL_OPERATOR_USER_ID = "desktop";
const WEB_OWNER_USER_ID = "web-owner";

function isStudioShellPath(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

function webPathNeedsWorker(pathname: string): boolean {
  if (isStudioShellPath(pathname)) return false;
  const mode = modeFromPathname(pathname);
  return mode === "dashboard" || mode === "email";
}

/** Console-scoped dashboard stores — mount only after the route gate passes. */
function OwnerConsoleDashboard({ children }: { children: ReactNode }) {
  return (
    <AccountsProvider>
      <AccountsSyncBridge />
      {children}
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
  const hideMainSidebar = isEmailSettings || isStudioSettingsPath(pathname);

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
                  <AppShellFrame teamMode hideSidebar={hideMainSidebar}>
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
                <AppShellFrame hideSidebar={hideMainSidebar}>
                  <ConsoleRouteGate>
                    <OwnerConsoleDashboard>
                      {hideMainSidebar ? null : <DomainProgressBanner />}
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

function WebOwnerGate({ children }: { children: ReactNode }) {
  return (
    <WebConsoleAppProviders>
      <EnableEmailApiDialogHost>
        <DashboardShell userId={WEB_OWNER_USER_ID}>{children}</DashboardShell>
      </EnableEmailApiDialogHost>
    </WebConsoleAppProviders>
  );
}

type DashboardGateMode =
  | "loading"
  | "desktop"
  | "web-owner"
  | "web-redirect-login"
  | "web-redirect-studio"
  | "web-redirect-onboarding";

export function DesktopDashboardGate({
  children,
}: {
  children: ReactNode;
  userId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [gateMode, setGateMode] = useState<DashboardGateMode>("loading");

  useEffect(() => {
    if (isDesktopRuntime()) {
      setGateMode("desktop");
      return;
    }

    let active = true;

    async function resolveWebGate() {
      const auth = await ensureWebCloudAuth();
      if (!active) return;

      if (auth === "login") {
        setGateMode("web-redirect-login");
        return;
      }

      if (await shouldRedirectToCloudOnboarding()) {
        setGateMode("web-redirect-onboarding");
        return;
      }

      if (auth === "ready") {
        setGateMode("web-owner");
        return;
      }

      if (webPathNeedsWorker(pathname)) {
        setGateMode("web-redirect-studio");
        return;
      }

      setGateMode("web-owner");
    }

    void resolveWebGate();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (gateMode === "web-redirect-login") {
      const next = `${pathname}${search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (gateMode === "web-redirect-studio") {
      router.replace("/studio/dashboard");
      return;
    }
    if (gateMode === "web-redirect-onboarding") {
      router.replace("/onboarding");
    }
  }, [gateMode, pathname, router]);

  if (
    gateMode === "loading" ||
    gateMode === "web-redirect-login" ||
    gateMode === "web-redirect-studio" ||
    gateMode === "web-redirect-onboarding"
  ) {
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
