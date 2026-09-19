"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy passtoken recovery → cloud OAuth password reset. */
export default function RecoverAdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);
  return null;
}
