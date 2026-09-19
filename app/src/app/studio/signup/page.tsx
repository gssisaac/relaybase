"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy `/studio/signup` → unified `/signup`. */
function StudioSignupRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/signup?${qs}` : "/signup");
  }, [router, searchParams]);

  return null;
}

export default function StudioSignupRedirectPage() {
  return (
    <Suspense fallback={null}>
      <StudioSignupRedirectInner />
    </Suspense>
  );
}
