"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAppSession } from "@/lib/desktop/app-session";

/**
 * Legacy route — teammate login is TeamLoginView only (`/login` → `/`).
 */
export default function SetupAccountRedirectPage() {
  const router = useRouter();
  const store = useAppSession();

  useEffect(() => {
    store.openInvitedLogin();
    router.replace("/login");
  }, [router, store]);

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
