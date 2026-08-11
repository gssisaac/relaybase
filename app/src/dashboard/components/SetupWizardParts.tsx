"use client";

const RESOURCE_NAMES = [
  {
    name: "relaybase-api",
    kind: "Worker",
    why: "Your routing + admin API process. You deploy it with Wrangler; the Mac app only talks to this URL.",
  },
  {
    name: "relaybase-app",
    kind: "KV",
    why: "Stores Relaybase runtime data, admin config, and API keys inside your account.",
  },
  {
    name: "relaybase-inbound",
    kind: "R2",
    why: "Stores raw inbound email. Created automatically during install.",
  },
] as const;

export function SetupStepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <StepDot active={step >= 1} n={1} label="Get ready" />
      <div className="h-px w-6 bg-border" />
      <StepDot active={step >= 2} n={2} label="Install" />
    </div>
  );
}

function StepDot({ active, n, label }: { active: boolean; n: number; label: string }) {
  return (
    <div
      className={
        "flex items-center gap-1.5 " +
        (active ? "font-medium text-foreground" : "text-muted-foreground")
      }
    >
      <span
        className={
          "flex size-5 items-center justify-center rounded-full border " +
          (active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground")
        }
      >
        {n}
      </span>
      {label}
    </div>
  );
}

export function ResourceAside() {
  return (
    <aside className="hidden w-72 shrink-0 space-y-3 rounded-lg border border-border p-4 md:block">
      <p className="text-sm font-medium">What gets created (and why)</p>
      <ul className="space-y-3">
        {RESOURCE_NAMES.map((r) => (
          <li key={`${r.kind}-${r.name}`} className="text-sm">
            <p className="font-mono text-xs">
              <span className="text-muted-foreground">{r.kind}</span>{" "}
              <span className="font-medium text-foreground">{r.name}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Cloudflare may bill a small Workers Paid plan fee (&#8776;$5/mo) directly
        to you. Relaybase Pro is a separate software license.
      </p>
    </aside>
  );
}
