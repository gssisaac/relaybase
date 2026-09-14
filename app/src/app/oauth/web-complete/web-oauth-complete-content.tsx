"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { WEB_CF_OAUTH_COMPLETE_MESSAGE } from "@/lib/desktop/bridge/web-oauth-paths";
import { consumeWebCfOAuthCompleteParam } from "@/lib/desktop/bridge/web-oauth-complete";

function safeNextPath(raw: string | null): string {
  if (!raw?.trim()) return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export function WebOAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const oauthError = searchParams.get("cf_oauth_error");
    const next = safeNextPath(searchParams.get("next"));
    const oauthOk = consumeWebCfOAuthCompleteParam();

    if (oauthError) {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "relaybase:cf-oauth-error", message: oauthError },
          window.location.origin,
        );
        window.close();
        return;
      }
      router.replace(`${next}?cf_oauth_error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (window.opener && !window.opener.closed && oauthOk) {
      window.opener.postMessage(
        { type: WEB_CF_OAUTH_COMPLETE_MESSAGE, next },
        window.location.origin,
      );
      window.close();
      return;
    }

    if (oauthOk) {
      router.replace(next);
      return;
    }

    router.replace(next);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Finishing Cloudflare authorization…
      </div>
    </div>
  );
}
