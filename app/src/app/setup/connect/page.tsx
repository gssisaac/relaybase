"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAppSession } from "@/lib/desktop/app-session";

/**
 * "Already installed" entry from the welcome choice. Enter UnlockView on `/` —
 * Touch ID when a keyring secret exists, otherwise the fingerprint surface
 * with passtoken as an optional fallback (not the default screen).
 */
export default function SetupConnectPage() {
  const router = useRouter();
  const store = useAppSession();

  useEffect(() => {
    store.openAlreadyInstalled();
    router.replace("/");
  }, [router, store]);

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
