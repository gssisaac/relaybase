"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RECOVER_ADMIN_PATH } from "@/lib/navigation/recover-admin";

/** Legacy bookmark → canonical `/recover-admin`. */
export function SetupRecoverAdminRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(query ? `${RECOVER_ADMIN_PATH}?${query}` : RECOVER_ADMIN_PATH);
  }, [router, searchParams]);

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
