"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy `/studio/login` → unified `/login`. */
function StudioLoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [router, searchParams]);

  return null;
}

export default function StudioLoginRedirectPage() {
  return (
    <Suspense fallback={null}>
      <StudioLoginRedirectInner />
    </Suspense>
  );
}
