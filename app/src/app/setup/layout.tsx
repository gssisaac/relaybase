"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  DesktopProvider,
  useDesktop,
} from "@/lib/desktop/DesktopContext";
import { isDesktopRuntime } from "@/lib/desktop/bridge";

function SetupShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, credentials } = useDesktop();

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
      <header className="border-b border-border px-6 py-4">
        <p className="text-sm font-semibold tracking-tight">Relaybase</p>
        <p className="text-xs text-muted-foreground">
          Built for your own Cloudflare account
        </p>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
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
    <DesktopProvider>
      <SetupShell>{children}</SetupShell>
    </DesktopProvider>
  );
}
