"use client";

import { Loader2 } from "lucide-react";
import { Suspense } from "react";

import { WebOAuthCompleteContent } from "./web-oauth-complete-content";

export default function WebOAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Finishing Cloudflare authorization…
          </div>
        </div>
      }
    >
      <WebOAuthCompleteContent />
    </Suspense>
  );
}
