"use client";

// Browser Cloudflare OAuth — install/update continues on SetupProgressPanelCore.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SetupCloudflareAuthorizeCard } from "@/console/components/setup/common/install/SetupCloudflareAuthorizeCard";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import {
  explainCfOAuthError,
  oauthAuthorizationIncompleteHelp,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import {
  openWebCfOAuthPopup,
  webOAuthStartHrefForPath,
} from "@/lib/desktop/bridge/web-oauth-authorize";
import {
  consumeWebCfOAuthCompleteParam,
  fetchWebCfOAuthSessionPresent,
} from "@/lib/desktop/bridge/web-oauth-complete";

/** Web install / update — Cloudflare authorize card (progress on /setup/progress). */
export function WebAuthorizeCard({
  afterAuthPath = "/setup/progress",
  buttonLabel = "Authorize and install on Cloudflare",
}: {
  afterAuthPath?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [sessionCheck, setSessionCheck] = useState<
    "checking" | "present" | "absent"
  >(() => (isDesktopRuntime() ? "absent" : "checking"));

  useEffect(() => {
    if (sessionCheck !== "checking") return;
    let active = true;
    void (async () => {
      const present = await fetchWebCfOAuthSessionPresent();
      if (!active) return;
      setSessionCheck(present ? "present" : "absent");
    })();
    return () => {
      active = false;
    };
  }, [sessionCheck]);

  useEffect(() => {
    if (isDesktopRuntime()) return;
    if (!consumeWebCfOAuthCompleteParam()) return;
    setSessionCheck("present");
    router.push(afterAuthPath);
  }, [afterAuthPath, router]);

  function beginInstall() {
    router.push(afterAuthPath);
  }

  function finishOAuthSuccess() {
    setOauthBusy(false);
    setSessionCheck("present");
    router.push(afterAuthPath);
  }

  function startAuthorize() {
    if (isDesktopRuntime()) return;
    setOauthError(null);
    setOauthBusy(true);
    const authorizeHref = webOAuthStartHrefForPath(afterAuthPath);
    openWebCfOAuthPopup(authorizeHref, {
      onComplete: () => finishOAuthSuccess(),
      onError: (message) => {
        setOauthBusy(false);
        setOauthError(explainCfOAuthError(message));
      },
    });
  }

  function handleCancelWait() {
    setOauthBusy(false);
    setOauthError(oauthAuthorizationIncompleteHelp("cancelled"));
  }

  if (sessionCheck === "checking") {
    return (
      <SetupCloudflareAuthorizeCard
        oauthBusy={true}
        oauthError={null}
        onAuthorize={() => {}}
        onCancelWait={() => {}}
        authorizeLabel={buttonLabel}
        diagramWaiting={true}
        waitingSubtitle="Checking your Cloudflare authorization…"
        showCancelWait={false}
      />
    );
  }

  if (sessionCheck === "present" && !oauthBusy) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-2">
        <div className="flex w-[300px] max-w-full flex-col items-center gap-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Cloudflare authorization is active
          </p>
          <p className="text-center text-xs text-muted-foreground">
            You already authorized Relaybase. Continue to the install, or authorize again to
            switch Cloudflare accounts.
          </p>
          <Button type="button" className="w-full" onClick={beginInstall}>
            Continue to install
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => {
              setSessionCheck("absent");
              void startAuthorize();
            }}
          >
            Authorize again
          </button>
        </div>
      </div>
    );
  }

  return (
    <SetupCloudflareAuthorizeCard
      oauthBusy={oauthBusy}
      oauthError={oauthError}
      onAuthorize={startAuthorize}
      onCancelWait={handleCancelWait}
      authorizeLabel={buttonLabel}
      diagramWaiting={oauthBusy}
    />
  );
}
