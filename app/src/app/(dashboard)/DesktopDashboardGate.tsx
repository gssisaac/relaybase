"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
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

function DesktopInner({
  children,
  userId,
}: {
  children: ReactNode;
  /** Cookie session when present (e.g. signed in as isaac after logout). */
  userId?: string;
}) {
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

  // First-run / no cookie → "desktop". After Sign in, use the session id.
  return (
    <DashboardShell userId={userId ?? "desktop"}>{children}</DashboardShell>
  );
}

/**
 * Owns the single dashboard chrome (sidebar + main).
 * Tauri: local credentials; session userId when cookie auth exists, else "desktop".
 * Browser: cookie-auth userId from the server layout.
 */
export function DesktopDashboardGate({
  children,
  userId,
}: {
  children: ReactNode;
  /** Present for browser/cookie auth; omitted for static DESKTOP_BUILD. */
  userId?: string;
}) {
  // null = not checked yet (SSR / first paint). Avoid nesting a browser shell
  // under Tauri once desktop runtime is detected.
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    setDesktop(isDesktopRuntime());
  }, []);

  if (desktop === true) {
    return (
      <DesktopShell>
        <DesktopProvider>
          <DesktopInner userId={userId}>{children}</DesktopInner>
        </DesktopProvider>
      </DesktopShell>
    );
  }

  // Browser path (or SSR before Tauri is detected): single shell with cookie user.
  if (userId) {
    return <DashboardShell userId={userId}>{children}</DashboardShell>;
  }

  // DESKTOP_BUILD / waiting for runtime check with no cookie userId.
  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
