"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";

function LegacyAudienceRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/studio/subscribers?${q}` : "/studio/subscribers");
  }, [searchParams, router]);

  return <AppLoadingScreen />;
}

export default function LegacyAudiencePage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <LegacyAudienceRedirect />
    </Suspense>
  );
}
