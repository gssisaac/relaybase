import { Suspense } from "react";

import { SetupRecoverAdminRedirect } from "./redirect-client";

export default function SetupRecoverAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
          Opening…
        </div>
      }
    >
      <SetupRecoverAdminRedirect />
    </Suspense>
  );
}
