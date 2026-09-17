"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy `/cloud/login` → `/studio/login`. */
export default function CloudLoginRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/studio/login${window.location.search}`);
  }, [router]);
  return null;
}
