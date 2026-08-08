"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy route — CF API token connect removed; self-install is the only path. */
export default function SetupConnectRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/setup/install");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-muted-foreground">
      Redirecting to Worker install…
    </div>
  );
}
