"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";

function LoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get("mode");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    const qs = params.toString();
    const base = mode === "worker" ? "/worker/login" : "/cloud/login";
    router.replace(qs ? `${base}?${qs}` : base);
  }, [router, searchParams]);

  return <AppLoadingScreen />;
}

/**
 * Legacy `/login` — redirects to `/cloud/login` or `/worker/login` so browsers
 * store autofill credentials per origin path.
 */
export default function LoginPage() {
  const router = useRouter();
  const store = useAppSession();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (isDesktop) {
      store.openInvitedLogin();
      router.replace("/");
    }
  }, [isDesktop, router, store]);

  if (!isDesktop) {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <LoginRedirectInner />
      </Suspense>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
