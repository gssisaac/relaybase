"use client";

import { useRouter } from "next/navigation";

import { OwnerUnlockPanel } from "@/console/components/setup/OwnerUnlockPanel";

/** Already installed — same unlock screen as the daily desktop gate. */
export default function SetupConnectPage() {
  const router = useRouter();
  return <OwnerUnlockPanel onUnlocked={() => router.replace("/")} />;
}
