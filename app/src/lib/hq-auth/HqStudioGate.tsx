"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { isDesktopRuntime } from "@/lib/desktop/bridge";

import { hasHqSession, hqRefreshSession } from "./session";

type GateState = "loading" | "allowed" | "redirect";

/** Web-only: Studio routes require an HQ Cloud session (30-day cookie + access JWT). */
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
    if (hasHqSession()) {
      setState("allowed");
      return;
    }
    let active = true;
    void hqRefreshSession().then((ok) => {
      if (!active) return;
      setState(ok ? "allowed" : "redirect");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state !== "redirect") return;
    const qs = searchParams.toString();
    const next = `${pathname}${qs ? `?${qs}` : ""}`;
    router.replace(`/cloud/login?next=${encodeURIComponent(next)}`);
  }, [state, pathname, router, searchParams]);

  if (state === "loading" || state === "redirect") {
    return <AppLoadingScreen />;
  }

  return children;
}
