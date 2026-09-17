"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy `/cloud/signup` → `/studio/signup`. */
export default function CloudSignupRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/studio/signup${window.location.search}`);
  }, [router]);
  return null;
}
