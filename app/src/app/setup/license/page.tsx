"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDesktop } from "@/lib/desktop/DesktopContext";
import { LicenseActivatePanel } from "@/relaybase-email/components/LicenseActivatePanel";

export default function SetupLicensePage() {
  const router = useRouter();
  const { credentials, ready } = useDesktop();

  useEffect(() => {
    if (!ready) return;
    if (!credentials?.accountId || !credentials.apiToken) {
      router.replace("/setup/connect");
      return;
    }
    if (!credentials.workerUrl) {
      router.replace("/setup/install");
    }
  }, [ready, credentials, router]);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 3 of 3
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Activate license
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Worker is linked
          {credentials?.workerUrl ? (
            <>
              {" "}
              at{" "}
              <span className="font-mono text-xs text-foreground">
                {credentials.workerUrl}
              </span>
            </>
          ) : null}
          . Activate your one-time license to open the dashboard.
        </p>
      </div>
      <LicenseActivatePanel />
    </div>
  );
}
