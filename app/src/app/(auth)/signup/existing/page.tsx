"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { SignupShell } from "@/features/auth/components/SignupShell";
import { readExistingSignupUsername } from "@/features/auth/lib/signup-session";

export default function SignupExistingAccountPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const name = readExistingSignupUsername();
    if (!name) {
      router.replace("/signup/check");
      return;
    }
    setUsername(name);
  }, [router]);

  if (!username) return null;

  return (
    <SignupShell>
      <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-center">
        <p className="text-sm font-medium">This Cloudflare account already has Relaybase</p>
        <p className="text-sm text-muted-foreground">
          Sign in with username{" "}
          <span className="font-mono font-semibold text-foreground">{username}</span>
        </p>
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          Sign in
        </Link>
        <p className="text-xs text-muted-foreground">
          <Link href="/forgot-password" className="hover:underline">
            Forgot password
          </Link>
        </p>
      </div>
    </SignupShell>
  );
}
