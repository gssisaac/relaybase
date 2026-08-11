"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthForm } from "../_components/AuthForm";

export default function RecoverPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(values: Record<string, string>) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setDevToken(null);
    try {
      const res = await fetch("/api/v1/account?action=recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        devToken?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Recover failed");
      if (data.devToken) {
        setDevToken(data.devToken);
        setSuccess("Recovery token issued (dev mode). Use it to reset your password.");
      } else {
        setSuccess("If an account exists for that email, a reset link has been sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recover failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthForm
      title="Reset your password"
      submitLabel="Send reset link"
      busy={busy}
      error={error}
      success={success}
      onSubmit={handleSubmit}
      fields={[
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          placeholder: "you@example.com",
        },
      ]}
      footer={
        <div className="flex flex-col gap-1">
          <Link href="/login" className="hover:underline">
            Back to log in
          </Link>
          {devToken ? (
            <Link
              href={`/reset-password?token=${encodeURIComponent(devToken)}`}
              className="font-mono hover:underline"
            >
              Continue to reset (dev token)
            </Link>
          ) : null}
        </div>
      }
    />
  );
}
