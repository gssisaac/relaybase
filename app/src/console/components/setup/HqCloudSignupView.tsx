"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerUrlPicker } from "@/console/components/setup/WorkerUrlPicker";
import { cn } from "@/lib/utils";
import { hqSignup } from "@/lib/hq-auth/session";
import {
  verifyWorkerForCloudSignup,
  type SignupWorkerRole,
} from "@/lib/hq-auth/verify-worker-signup";
import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";

function redirectAfterAuth(router: ReturnType<typeof useRouter>, next: string | null) {
  if (next?.startsWith("/")) {
    router.push(next);
    return;
  }
  router.push("/studio/dashboard");
}

type VerifiedWorker = {
  role: SignupWorkerRole;
  workerUrl: string;
  passtoken?: string;
  accountEmail?: string;
  teamPassword?: string;
};

/** HQ Cloud sign-up — `/cloud/signup` (Step 1: Worker proof, Step 2: account). */
export function HqCloudSignupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [step, setStep] = useState<1 | 2>(1);
  const [verified, setVerified] = useState<VerifiedWorker | null>(null);

  const [role, setRole] = useState<SignupWorkerRole>("owner");
  const [workerUrl, setWorkerUrl] = useState("");
  const [passtoken, setPasstoken] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [teamPassword, setTeamPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailLocked, setEmailLocked] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUrl = normalizeWorkerUrl(workerUrl);
  const canVerifyStep1 =
    Boolean(trimmedUrl) &&
    (role === "owner" ? Boolean(passtoken.trim()) : Boolean(accountEmail.trim() && teamPassword));

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmitStep2 =
    Boolean(name.trim() && email.trim() && password && passwordsMatch);

  async function handleVerifyWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!canVerifyStep1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyWorkerForCloudSignup({
        role,
        workerUrl: trimmedUrl,
        passtoken: role === "owner" ? passtoken : undefined,
        accountEmail: role === "team" ? accountEmail : undefined,
        teamPassword: role === "team" ? teamPassword : undefined,
      });
      const snapshot: VerifiedWorker = {
        role,
        workerUrl: trimmedUrl,
        ...(role === "owner"
          ? { passtoken }
          : { accountEmail: accountEmail.trim().toLowerCase(), teamPassword }),
      };
      setVerified(snapshot);
      if (role === "team") {
        setEmail(accountEmail.trim().toLowerCase());
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitStep2 || !verified || busy) return;
    setBusy(true);
    setError(null);
    try {
      await hqSignup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        workerUrl: verified.workerUrl,
        workerProof:
          verified.role === "owner"
            ? { kind: "owner", passtoken: verified.passtoken ?? "" }
            : {
                kind: "team",
                accountEmail: verified.accountEmail ?? "",
                teamPassword: verified.teamPassword ?? "",
              },
      });
      redirectAfterAuth(router, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  const loginHref = next
    ? `/cloud/login?next=${encodeURIComponent(next)}`
    : "/cloud/login";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create Relaybase Cloud account</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 2 —{" "}
            {step === 1 ? "Verify your Worker" : "Your Cloud profile"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className={cn(step === 1 && "font-medium text-foreground")}>1. Worker</span>
          <span aria-hidden>→</span>
          <span className={cn(step === 2 && "font-medium text-foreground")}>2. Account</span>
        </div>

        {step === 1 ? (
          <form
            className="space-y-4"
            name="relaybase-cloud-signup-worker"
            autoComplete="off"
            onSubmit={handleVerifyWorker}
          >
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
              {(["owner", "team"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-md py-1.5 font-medium transition-colors",
                    role === r
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "owner" ? "Owner" : "Teammate"}
                </button>
              ))}
            </div>

            <WorkerUrlPicker value={workerUrl} onChange={setWorkerUrl} disabled={busy} />

            {role === "team" ? (
              <div className="space-y-1.5">
                <Label htmlFor="signup-team-email">Account email</Label>
                <Input
                  id="signup-team-email"
                  name="relaybase-signup-team-email"
                  type="email"
                  autoComplete="off"
                  data-1p-ignore
                  required
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="signup-worker-secret">
                {role === "owner" ? "Passtoken" : "Password"}
              </Label>
              <Input
                id="signup-worker-secret"
                name="relaybase-signup-worker-secret"
                type="password"
                autoComplete="off"
                data-1p-ignore
                required
                value={role === "owner" ? passtoken : teamPassword}
                onChange={(e) =>
                  role === "owner"
                    ? setPasstoken(e.target.value)
                    : setTeamPassword(e.target.value)
                }
                className={cn(role === "owner" && "font-mono text-xs")}
                disabled={busy}
              />
              {role === "owner" ? (
                <p className="text-[11px] text-muted-foreground">
                  Used once to prove Worker ownership — not stored on Relaybase Cloud.
                </p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy || !canVerifyStep1}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Verify &amp; continue
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            name="relaybase-cloud-signup-profile"
            autoComplete="off"
            onSubmit={handleCreateAccount}
          >
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
              Connected: {verified?.workerUrl}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="hq-signup-name">Name</Label>
              <Input
                id="hq-signup-name"
                name="relaybase-cloud-display-name"
                autoComplete="off"
                data-1p-ignore
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hq-signup-email">Email</Label>
              <Input
                id="hq-signup-email"
                name="relaybase-cloud-signup-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                data-1p-ignore
                readOnly={emailLocked}
                onFocus={() => setEmailLocked(false)}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hq-signup-password">Password</Label>
              <Input
                id="hq-signup-password"
                name="relaybase-cloud-signup-password"
                type="password"
                autoComplete="new-password"
                data-1p-ignore
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hq-signup-confirm">Confirm password</Label>
              <Input
                id="hq-signup-confirm"
                name="relaybase-cloud-signup-confirm"
                type="password"
                autoComplete="new-password"
                data-1p-ignore
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={busy}
              />
              {confirmPassword && !passwordsMatch ? (
                <p className="text-[11px] text-destructive">Passwords do not match.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  At least 10 characters. HQ Cloud only — not your Worker passtoken.
                </p>
              )}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={busy || !canSubmitStep2}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Create account
              </Button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
