"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";

/**
 * "I was invited" entry from the welcome choice. Enter TeamLoginView on `/` via
 * the shared phase screen — same trampoline pattern as `/setup/connect`.
 */
export default function TeamLoginPage() {
  const router = useRouter();
  const store = useAppSession();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (!isDesktop) {
      const auth = getWebTeamAuth();
      if (auth) {
        router.replace("/inbox");
      } else {
        router.replace("/sign-in");
      }
      return;
    }
    store.openInvitedLogin();
    router.replace("/");
  }, [isDesktop, router, store]);

  if (!isDesktop) {
    return null;
  }

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
