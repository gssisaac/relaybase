"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthForm } from "../_components/AuthForm";

export default function SignupPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account?action=signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Signup failed");
      window.location.href = "/account";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthForm
      title="Create your Relaybase account"
      submitLabel="Create account"
      busy={busy}
      error={error}
      onSubmit={handleSubmit}
      fields={[
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          placeholder: "you@example.com",
        },
        {
          name: "password",
          label: "Password (min 8 characters)",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
      footer={
        <div className="flex flex-col gap-1">
          <Link href="/login" className="hover:underline">
            Already have an account? Log in
          </Link>
        </div>
      }
    />
  );
}
