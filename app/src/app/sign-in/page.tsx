"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy `/sign-in` bookmark → `/login`. Client-side because the static
 * export has no server redirects; keeps `?workerUrl=` and other params.
 */
export default function SignInRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/cloud/login${window.location.search}`);
  }, [router]);

  return null;
}
