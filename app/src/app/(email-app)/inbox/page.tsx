"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMailRuntime } from "@/mail-platform/runtime";

/**
 * Inbox page — email mode.
 *
 * Redirects to /login when not signed in. The actual mail list UI
 * will be wired in the next migration step (replacing useDesktop with
 * useMailRuntime inside email/stores).
 */
export default function InboxPage() {
  const router = useRouter();
  const { session } = useMailRuntime();

  useEffect(() => {
    if (session.ready && !session.identity) {
      router.replace("/sign-in");
    }
  }, [session.ready, session.identity, router]);

  if (!session.ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session.identity) {
    return null;
  }

  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Inbox — mail UI will be wired in the next step.
    </div>
  );
}
