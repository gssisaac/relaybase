"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy email reset tokens → CF OAuth password reset. */
export default function ResetPasswordRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);
  return null;
}
