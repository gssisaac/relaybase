"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function EmailsLegacyRedirect({ rest }: { rest: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const tail = rest.filter(Boolean);
    const path = tail.length
      ? `/email/${tail.map(encodeURIComponent).join("/")}`
      : "/email/inbox";
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    router.replace(`${path}${search}`);
  }, [rest, router]);
  return null;
}
