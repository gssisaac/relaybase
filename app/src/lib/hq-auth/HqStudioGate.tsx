"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { isDesktopRuntime } from "@/lib/desktop/bridge";

import { ensureCloudWorkerSession } from "@/lib/auth/cloud-worker-session";
import { hasHqSession, hqRefreshSession } from "./session";

type GateState = "loading" | "allowed" | "redirect";

/** Web-only: Studio routes require a Studio session (30-day cookie + access JWT). */
export function HqStudioGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    if (isDesktopRuntime()) {
      setState("allowed");
      return;
    }

    let active = true;

    async function resolve() {
      let ok = hasHqSession();
      if (!ok) {
        ok = await hqRefreshSession();
      }
      if (!active) return;
      if (ok) {
        await ensureCloudWorkerSession();
      }
      if (!active) return;
      setState(ok ? "allowed" : "redirect");
    }

    void resolve();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state !== "redirect") return;
    const qs = searchParams.toString();
    const next = `${pathname}${qs ? `?${qs}` : ""}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [state, pathname, router, searchParams]);

  if (state === "loading" || state === "redirect") {
    return <AppLoadingScreen />;
  }

  return children;
}
