"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Already installed" entry from the welcome choice. The dashboard gate (and
 * the session store) own the unlock flow now, so just bounce to `/` — the
 * gate renders Touch ID / the passtoken form as needed.
 */
export default function SetupConnectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
