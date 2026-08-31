"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthForm } from "../_components/AuthForm";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(values: Record<string, string>) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/account?action=reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: values.token,
          password: values.password,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Reset failed");
      setSuccess("Password reset. You can now log in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  const initialToken = params.get("token") ?? "";

  return (
    <AuthForm
      title="Set a new password"
      submitLabel="Reset password"
      busy={busy}
      error={error}
      success={success}
      onSubmit={handleSubmit}
      initialValues={{ token: initialToken }}
      fields={[
        {
          name: "token",
          label: "Recovery token",
          autoComplete: "off",
          placeholder: "token from your email",
          required: true,
        },
        {
          name: "password",
          label: "New password (min 8 characters)",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
      footer={
        <div className="flex flex-col gap-1">
          <Link href="/login" className="hover:underline">
            Back to log in
          </Link>
        </div>
      }
    />
  );
}
