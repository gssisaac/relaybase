import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Relaybase</h1>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Account, billing, license, and recovery console.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Link
          href="/login"
          className="rounded-md bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)] hover:opacity-90"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--muted)]"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
