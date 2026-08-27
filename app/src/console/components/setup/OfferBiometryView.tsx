"use client";

import { Fingerprint } from "lucide-react";

import { MacDesktopTitlebarSpacer } from "@/components/layout/MacDesktopTitlebarSpacer";
import { Button } from "@/components/ui/button";
import { useAppSession } from "@/lib/desktop/app-session";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

/**
 * One-time biometry offer after first owner passtoken or invited login.
 * Accept → enable Touch ID / Windows Hello in the OS keyring blob.
 * Decline → keep the keyring session but require passtoken/password next launch.
 */
export function OfferBiometryView({ role }: { role: "owner" | "invited" }) {
  const store = useAppSession();
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();
  const label = store.biometryLabel;

  return (
    <div className="flex h-svh flex-col bg-background">
      <MacDesktopTitlebarSpacer />
      <div
        {...dragRegionProps}
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center px-6",
          dragRegionClassName,
        )}
      >
        <div
          className={cn("w-full max-w-sm space-y-4 text-center", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Fingerprint className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              Unlock with {label}?
            </h1>
            <p className="text-xs text-muted-foreground">
              {role === "owner"
                ? `Save this device session in the keychain so the next time you open Relaybase it unlocks with ${label}. Your passtoken is never written to disk.`
                : `Store your mobile password in this device's keychain so the next time you open Relaybase it unlocks with ${label}. The password is never written to disk.`}
            </p>
          </div>
          {store.error ? (
            <p className="text-xs text-destructive">{store.error}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={store.busy}
              onClick={() => void store.acceptBiometry()}
            >
              {store.busy ? "Enabling…" : `Use ${label}`}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={store.busy}
              onClick={() => void store.declineBiometry()}
            >
              Not now
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Not now means you&apos;ll re-enter your{" "}
            {role === "owner" ? "passtoken" : "password"} every launch.
          </p>
        </div>
      </div>
    </div>
  );
}
