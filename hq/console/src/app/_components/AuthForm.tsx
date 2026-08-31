"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type AuthFormProps = {
  title: string;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  fields: Array<{
    name: string;
    label: string;
    type?: string;
    placeholder?: string;
    autoComplete?: string;
    required?: boolean;
  }>;
  initialValues?: Record<string, string>;
  error?: string | null;
  success?: string | null;
  busy?: boolean;
  footer?: React.ReactNode;
};

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  fields,
  initialValues,
  error,
  success,
  busy,
  footer,
}: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    initialValues ?? {},
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="space-y-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(values);
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <label
                htmlFor={f.name}
                className="text-xs font-medium text-[color:var(--muted-foreground)]"
              >
                {f.label}
              </label>
              <input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
                required={f.required ?? true}
                value={values[f.name] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
                className={cn(
                  "w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]",
                )}
              />
            </div>
          ))}
          {error ? (
            <p className="text-xs text-[color:var(--destructive)]">{error}</p>
          ) : null}
          {success ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {success}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)]",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </button>
        </form>
        {footer ? (
          <div className="border-t border-[color:var(--border)] pt-4 text-xs text-[color:var(--muted-foreground)]">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
