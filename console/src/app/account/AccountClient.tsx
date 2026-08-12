"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

type Account = {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
};

export default function AccountClient() {
  const params = useSearchParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const checkoutStatus = params.get("checkout");
  const portalReturn = params.get("portal");

  async function refresh() {
    try {
      const res = await fetch("/api/v1/account", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; account?: Account; error?: string };
      if (!res.ok || !data.ok || !data.account) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error(data.error ?? "Failed to load account");
      }
      setAccount(data.account);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  // Initial account fetch. setState happens after the first await inside
  // refresh(); the rule below is the standard carve-out for initial data load.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function handleUpgrade(annual: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annual }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePortal() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Portal failed");
      window.location.href = data.url;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/v1/account?action=logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[color:var(--muted-foreground)]" />
      </main>
    );
  }

  if (error && !account) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
        <p className="text-sm text-[color:var(--destructive)]">{error}</p>
        <Link href="/login" className="text-sm hover:underline">
          Back to log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {account?.email}
        </p>
      </header>

      {checkoutStatus === "success" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Payment received — your Pro license has been issued.
        </p>
      ) : null}
      {checkoutStatus === "cancel" ? (
        <p className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]">
          Checkout was cancelled.
        </p>
      ) : null}
      {portalReturn ? (
        <p className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]">
          Subscription updated.
        </p>
      ) : null}
      {notice ? (
        <p className="text-xs text-[color:var(--destructive)]">{notice}</p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-[color:var(--border)] p-5">
        <h2 className="text-sm font-medium">Plan</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Relaybase Pro is a one-time software license. Cloudflare account
          fees (e.g. Workers Paid) are billed separately by Cloudflare to you.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleUpgrade(false)}
            className="rounded-md bg-[color:var(--primary)] px-3 py-2 text-xs font-medium text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            Upgrade to Pro
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleUpgrade(true)}
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--muted)] disabled:opacity-50"
          >
            Pro + annual updates
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePortal()}
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--muted)] disabled:opacity-50"
          >
            Manage billing
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-[color:var(--border)] p-5 text-sm">
        <h2 className="font-medium">Worker</h2>
        <p className="text-[color:var(--muted-foreground)]">
          Install the Relaybase routing Worker into your Cloudflare account
          from the desktop app. Your Worker URL is registered here once setup
          completes.
        </p>
      </section>

      <div className="flex justify-between text-xs text-[color:var(--muted-foreground)]">
        <span>
          Account created {account ? new Date(account.createdAt).toLocaleDateString() : "—"}
        </span>
        <button type="button" onClick={() => void handleLogout()} className="hover:underline">
          Log out
        </button>
      </div>
    </main>
  );
}
