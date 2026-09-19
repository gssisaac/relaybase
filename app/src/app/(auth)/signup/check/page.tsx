"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CheckingStateCard } from "@/features/auth/components/CheckingStateCard";
import { SignupShell } from "@/features/auth/components/SignupShell";
import { saveExistingSignupUsername } from "@/features/auth/lib/signup-session";

export default function SignupCheckPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void (async () => {
      const oauthRes = await fetch("/api/oauth/session", { credentials: "include" });
      const oauth = (await oauthRes.json()) as { present?: boolean; accountId?: string };
      if (!active) return;
      if (!oauth.present) {
        router.replace("/signup");
        return;
      }

      const lookupRes = await fetch("/api/auth/cloud-account-lookup", {
        credentials: "include",
        cache: "no-store",
      });
      const lookup = (await lookupRes.json()) as {
        exists?: boolean;
        username?: string;
        error?: string;
      };
      if (!active) return;
      if (!lookupRes.ok) {
        router.replace("/signup/probe");
        return;
      }
      if (lookup.exists && lookup.username) {
        saveExistingSignupUsername(lookup.username);
        router.replace("/signup/existing");
        return;
      }
      router.replace("/signup/probe");
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <SignupShell>
      <CheckingStateCard
        title="Checking Cloudflare Account"
        description="Verifying authorization and checking for existing Relaybase accounts…"
      />
    </SignupShell>
  );
}
