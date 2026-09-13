"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMailRuntime } from "@/mail-platform/runtime";

export default function SettingsPage() {
  const router = useRouter();
  const { session } = useMailRuntime();

  useEffect(() => {
    if (session.ready && !session.identity) {
      router.replace("/sign-in");
    }
  }, [session.ready, session.identity, router]);

  if (!session.ready || !session.identity) return null;

  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Settings — mail UI will be wired in the next step.
    </div>
  );
}
