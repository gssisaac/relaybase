"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** License gate removed (freemium). Redirect away. */
export default function SetupLicenseRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-muted-foreground">
      Redirecting…
    </div>
  );
}
