"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy `/signup` → `/studio/signup`. */
export default function SignupRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/studio/signup${window.location.search}`);
  }, [router]);
  return null;
}
