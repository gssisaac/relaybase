"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DesktopShell } from "@/components/layout/DesktopShell";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import {
  DesktopProvider,
  useDesktop,
} from "@/lib/desktop/DesktopContext";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";

function SetupShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, credentials } = useDesktop();
  const { isDesktop, isMacOS } = useDesktopChrome();

  useEffect(() => {
    if (!ready) return;
    if (credentials?.workerUrl && credentials.adminToken) {
      router.replace("/");
    }
  }, [ready, credentials, router]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {isDesktop && isMacOS ? (
        <div aria-hidden className="w-full shrink-0" style={{ height: 28 }} />
      ) : null}
      <DesktopTitleBar className="px-6 py-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">Relaybase</p>
          <p className="text-xs text-muted-foreground">
            Built for your own Cloudflare account
          </p>
        </div>
      </DesktopTitleBar>
      <main className="flex-1 overflow-y-auto select-none">{children}</main>
    </div>
  );
}

export default function SetupLayout({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isDesktopRuntime());
  }, []);

  if (!desktop) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium">Desktop setup</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cloudflare Worker install runs inside the Relaybase Mac app.
        </p>
      </div>
    );
  }

  return (
    <DesktopShell>
      <DesktopProvider>
        <SetupShell>{children}</SetupShell>
      </DesktopProvider>
    </DesktopShell>
  );
}
