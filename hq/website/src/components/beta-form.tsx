"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { DownloadCtaLabel } from "@/components/download-cta-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackCtaClick } from "@/lib/analytics";
import { siteConfig } from "@/lib/site-config";

type Status = "idle" | "loading" | "success" | "already" | "error";

export function BetaForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    emailRef.current?.focus();
  }, [autoFocus]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("loading");

    trackCtaClick({ label: "join_beta", location: "get-started" });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const res = await fetch("/api/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, timezone }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyJoined?: boolean;
      };

      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setEmail("");
      setStatus(data.alreadyJoined ? "already" : "success");
    } catch {
      setStatus("error");
      setError("Could not reach the server. Please try again.");
    }
  }

  if (status === "success" || status === "already") {
    return (
      <div className="rounded-xl border border-accent-teal/30 bg-accent p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-accent-teal" />
        <p className="mt-3 text-lg font-semibold text-accent-foreground">
          {status === "already"
            ? "You're already in the beta"
            : "You're in the beta"}
        </p>
        <p className="mt-1.5 text-sm text-accent-foreground/80">
          Check your email for the download link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="beta-email" className="sr-only">
        Email address
      </label>
      <Input
        ref={emailRef}
        id="beta-email"
        type="email"
        name="email"
        autoComplete="email"
        autoFocus={autoFocus}
        required
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={status === "loading"}
        aria-invalid={status === "error"}
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={status === "loading" || !email.trim()}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="animate-spin" data-icon="inline-start" />
            Joining…
          </>
        ) : (
          <>
            <DownloadCtaLabel />
            <ArrowRight data-icon="inline-end" />
          </>
        )}
      </Button>
      {error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          We will email a welcome note and a personal download link from{" "}
          {siteConfig.beta.from}.
        </p>
      )}
    </form>
  );
}
