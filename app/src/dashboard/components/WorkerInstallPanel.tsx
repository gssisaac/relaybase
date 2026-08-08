"use client";

import { Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WORKER_INSTALL_ZIP_URL,
  desktopOpenExternal,
  desktopSaveWorkerConnection,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { AdminTokenPanel } from "@/dashboard/components/AdminTokenPanel";

const DRAFT_KEY = "relaybase.setup.install.draft";

type Draft = {
  workerUrl: string;
  adminToken: string;
};

function loadDraft(): Draft {
  if (typeof window === "undefined") {
    return { workerUrl: "", adminToken: "" };
  }
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { workerUrl: "", adminToken: "" };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      workerUrl: typeof parsed.workerUrl === "string" ? parsed.workerUrl : "",
      adminToken:
        typeof parsed.adminToken === "string" ? parsed.adminToken : "",
    };
  } catch {
    return { workerUrl: "", adminToken: "" };
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

const RESOURCE_NAMES = [
  {
    name: "relaybase-api",
    kind: "Worker",
    why: "Your routing + admin API process. You deploy it with Wrangler; the Mac app only talks to this URL.",
  },
  {
    name: "relaybase-keys",
    kind: "KV",
    why: "Stores admin config and API keys inside your account.",
  },
  {
    name: "relaybase-api",
    kind: "KV",
    why: "Stores Relaybase runtime data next to the Worker.",
  },
  {
    name: "relaybase-inbound",
    kind: "R2",
    why: "Stores raw inbound email. Create this exact bucket name before deploy.",
  },
] as const;

const STEPS = [
  "Download the install ZIP and unzip it.",
  "Create KV namespaces and the R2 bucket (commands are in the README), then paste KV ids into wrangler.toml.",
  "Paste or generate an Admin token, copy the wrangler command, run it, then deploy.",
  "Paste the *.workers.dev URL + the same Admin token below, then verify (or skip).",
] as const;

export function WorkerInstallPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"verify" | "skip" | null>(null);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Restore draft / saved creds once — never wipe on failed verify.
  useEffect(() => {
    const draft = loadDraft();
    setWorkerUrl(
      draft.workerUrl || credentials?.workerUrl || "",
    );
    setAdminToken(
      draft.adminToken || credentials?.adminToken || "",
    );
    setHydrated(true);
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ workerUrl, adminToken });
  }, [hydrated, workerUrl, adminToken]);

  async function persistAndContinue(opts: {
    url: string;
    token: string;
    scriptName?: string;
    skippedVerify: boolean;
  }) {
    await desktopSaveWorkerConnection({
      workerUrl: opts.url,
      adminToken: opts.token,
      workerScriptName: opts.scriptName,
    });
    setMessage(
      opts.skippedVerify
        ? `Saved ${opts.url} (verify skipped). Continuing…`
        : `Connected to ${opts.url}`,
    );
    await refresh();
    router.replace("/");
  }

  async function handleVerify() {
    setBusy("verify");
    setError(null);
    setMessage(null);
    const url = workerUrl;
    const token = adminToken;
    try {
      const result = await desktopVerifyWorkerConnection(url, token);
      await persistAndContinue({
        url: result.workerUrl,
        token,
        scriptName: result.workerScriptName,
        skippedVerify: false,
      });
    } catch (err) {
      // Keep URL/token state — do not reset inputs.
      setWorkerUrl(url);
      setAdminToken(token);
      setError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip() {
    setBusy("skip");
    setError(null);
    setMessage(null);
    const url = workerUrl.trim();
    const token = adminToken.trim();
    try {
      if (!url || !token) {
        throw new Error("Worker URL and Admin token are required to continue.");
      }
      await persistAndContinue({
        url,
        token,
        scriptName: "relaybase-api",
        skippedVerify: true,
      });
    } catch (err) {
      setWorkerUrl(workerUrl);
      setAdminToken(adminToken);
      setError(explainDesktopError(err, "Could not save connection"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Install routing Worker
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You deploy Relaybase into <strong>your</strong> Cloudflare account with
          Wrangler. This app never asks for Workers, KV, or R2 API permissions —
          it only needs the Worker URL and admin token after you install.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Download the install package</p>
        <p className="text-xs text-muted-foreground">
          Includes a customer <span className="font-mono">wrangler.toml</span>,
          Worker source, and a step-by-step README.
        </p>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
        >
          <Download className="size-3.5" />
          Download Worker install ZIP
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">What you create (and why)</p>
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
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Deploy with Wrangler</p>
        <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <AdminTokenPanel value={adminToken} onChange={setAdminToken} />

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Connect</p>
        <div className="space-y-1.5">
          <Label htmlFor="worker-url">Worker URL</Label>
          <Input
            id="worker-url"
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value)}
            placeholder="https://relaybase-api.<subdomain>.workers.dev"
            className="font-mono text-xs"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-token-verify">Admin token (for Verify)</Label>
          <Input
            id="admin-token-verify"
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="Paste the token you put in wrangler secret"
            className="font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <DesktopErrorBanner error={error} />
        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={!workerUrl.trim() || !adminToken.trim() || busy !== null}
            onClick={() => void handleVerify()}
          >
            {busy === "verify" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Verify &amp; continue
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!workerUrl.trim() || !adminToken.trim() || busy !== null}
            onClick={() => void handleSkip()}
          >
            {busy === "skip" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Skip verify &amp; continue
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Skip saves the URL and token locally and goes to license. Use this
            when the Worker is already deployed and verify is stuck.
          </p>
        </div>
      </div>
    </div>
  );
}
