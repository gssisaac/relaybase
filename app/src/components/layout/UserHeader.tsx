"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { Button } from "@/components/ui/button";

export function UserHeader() {
  const userId = useProductId();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/accounts" className="font-semibold tracking-tight">
          Relaybase
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {userId}
          </span>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
