"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAppSession } from "@/lib/desktop/app-session";

/**
 * "I was invited" entry from the welcome choice. Enter TeamLoginView on `/` via
 * the shared phase screen — same trampoline pattern as `/setup/connect`.
 */
export default function TeamLoginPage() {
  const router = useRouter();
  const store = useAppSession();

  useEffect(() => {
    store.openInvitedLogin();
    router.replace("/");
  }, [router, store]);

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
