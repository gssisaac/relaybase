"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useEmailPaths } from "@/email/lib/paths";

export default function Page() {
  const router = useRouter();
  const { inbox } = useEmailPaths();
  useEffect(() => {
    router.replace(inbox);
  }, [inbox, router]);
  return null;
}
