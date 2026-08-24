"use client";

import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CF_OAUTH_INSTALL_SCOPES, type DesktopErrorHelp } from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";

const ACTION_WIDTH = "w-[300px] max-w-full";

function CloudflareMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 65 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fill="#F38020"
        d="M56.4 23.7c.2-1.3-.1-2.6-.8-3.7-1.3-2-3.7-3.1-6.2-2.8-.5-3.5-3.4-6.3-6.9-6.8-4.2-.6-8 2-8.9 5.9-2.7.2-5.1 1.7-6.3 4.1-1.3 2.5-1 5.5.7 7.7h26.4c2.4 0 4.4-1.8 4.6-4.2l-.6-.2z"
      />
      <path
        fill="#FAAD3F"
        d="M57.2 24.8c-.3 1.2-1.3 2-2.5 2H18.8c-2.8 0-4.8-2.7-4-5.4.6-1.7 2.2-2.8 4-2.9 1.1-4.1 5.2-6.5 9.4-5.4 1.7.5 3.1 1.7 3.9 3.2 2.6-.4 5.1 1.4 5.8 3.9.1.5.2 1 .2 1.5 0 .5-.1 1-.3 1.5.4.3.9.5 1.4.6z"
      />
    </svg>
  );
}

function OAuthConnectDiagram({ waiting }: { waiting: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-5">
        <div className="flex size-18 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm">
          <img src="/icon.png" alt="" width={40} height={40} className="size-10" />
        </div>
        <div className="flex min-w-18 items-center gap-1 text-muted-foreground">
          <span className="h-px flex-1 border-t border-dashed border-muted-foreground/70" />
          <ArrowRight
            className={
              "size-4 shrink-0 " + (waiting ? "animate-pulse text-brand" : "")
            }
          />
          <span className="h-px flex-1 border-t border-dashed border-muted-foreground/70" />
        </div>
        <div className="flex size-18 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm">
          <CloudflareMark className="h-8 w-11" />
        </div>
      </div>
      {waiting ? (
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Complete authorization in your browser, then return here.
        </p>
      ) : null}
    </div>
  );
}

export function SetupCloudflareAuthorizeCard({
  oauthBusy,
  oauthError,
  onAuthorize,
  onCancelWait,
  authorizeLabel = "Authorize and install on Cloudflare",
}: {
  oauthBusy: boolean;
  oauthError: DesktopErrorHelp | null;
  onAuthorize: () => void;
  onCancelWait: () => void;
  authorizeLabel?: string;
}) {
  const buttonLabel = oauthBusy
    ? "Waiting for authorization…"
    : authorizeLabel;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-2">
      <div className="flex flex-col items-center gap-2">
        <OAuthConnectDiagram waiting={oauthBusy} />

        <div className={`flex ${ACTION_WIDTH} flex-col items-center`}>
          <p className="text-sm font-medium">We are asking permissions</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {CF_OAUTH_INSTALL_SCOPES.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
        </div>

        {oauthError ? (
          <div className={ACTION_WIDTH}>
            <DesktopErrorBanner error={oauthError} />
          </div>
        ) : null}

        <div className={`flex ${ACTION_WIDTH} flex-col items-center gap-1`}>
          <Button
            type="button"
            className="w-full"
            disabled={oauthBusy}
            onClick={onAuthorize}
          >
            {oauthBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {buttonLabel}
          </Button>
          {oauthBusy ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={onCancelWait}
            >
              Cancel authorization
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
