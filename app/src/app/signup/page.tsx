"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy `/signup` → `/cloud/signup`. */
export default function SignupRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/cloud/signup${window.location.search}`);
  }, [router]);
  return null;
}
