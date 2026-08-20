"use client";

import { UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { SETUP_PAGE_SHELL } from "@/console/components/setup/setup-page-chrome";
import { cn } from "@/lib/utils";

const CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.relaybase.xyz";

export default function SetupChoicePage() {
  const router = useRouter();
  const [navigating, setNavigating] = useState<
    "install" | "invited" | "connect" | null
  >(null);

  function goInstall() {
    setNavigating("install");
    router.push("/setup/install");
  }

  function goInvited() {
    setNavigating("invited");
    router.push("/setup/account");
  }

  function goAlreadyInstalled() {
    setNavigating("connect");
    router.push("/setup/connect");
  }

  async function goRecover() {
    await desktopOpenExternal(`${CONSOLE_URL}/recover`);
  }

  return (
    <div className={cn(SETUP_PAGE_SHELL, "max-w-3xl")}>
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Relaybase
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose how you&apos;d like to get started. You can change your mind
            later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg">
              <img
                src="/icon.png"
                alt=""
                width={40}
                height={40}
                className="size-10"
              />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">Install on my Cloudflare</p>
              <p className="text-xs text-muted-foreground">
                Relaybase runs entirely in your own Cloudflare account. We&apos;ll
                guide you through it step by step.
              </p>
            </div>
            <Button
              className="mt-1 w-full"
              size="lg"
              disabled={navigating !== null}
              onClick={goInstall}
            >
              {navigating === "install" ? "Opening…" : "Start install"}
            </Button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <button
                type="button"
                className="hover:underline"
                onClick={() => void goRecover()}
              >
                I lost my admin token
              </button>
              <button
                type="button"
                className="hover:underline"
                disabled={navigating !== null}
                onClick={goAlreadyInstalled}
              >
                Already installed
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <UserCheck className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">I was invited</p>
              <p className="text-xs text-muted-foreground">
                Sign in with the Relaybase account your admin created for you.
              </p>
            </div>
            <Button
              className="mt-1 w-full"
              size="lg"
              variant="outline"
              disabled={navigating !== null}
              onClick={goInvited}
            >
              {navigating === "invited" ? "Opening…" : "Sign in"}
            </Button>
            <span className="text-xs text-transparent select-none">
              Already installed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
