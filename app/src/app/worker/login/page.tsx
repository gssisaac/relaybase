"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy worker passtoken login → cloud username login. */
function WorkerLoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [router, searchParams]);

  return null;
}

export default function WorkerLoginRedirectPage() {
  return (
    <Suspense fallback={null}>
      <WorkerLoginRedirectInner />
    </Suspense>
  );
}
