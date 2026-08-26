"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  desktopRegisterWorkerWithConsole,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import {
  ownerConnectProbe,
  ownerLogin,
} from "@/lib/desktop/owner-session";
import { SetupCenteredPage } from "@/console/components/setup/setup-page-chrome";

function applyWorkerUrl(url: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  w.__RELAYBASE_WORKER_URL__ = url.replace(/\/$/, "");
}

export default function SetupConnectPage() {
  const router = useRouter();
  const { credentials, setCredentials } = useDesktop();
  const [workerUrl, setWorkerUrl] = useState(credentials?.workerUrl ?? "");
  const [username, setUsername] = useState("");
  const [passtoken, setPasstoken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = workerUrl.trim().replace(/\/$/, "");
      applyWorkerUrl(url);
      await ownerLogin({ username, passtoken, label: "desktop" });
      const result = await ownerConnectProbe();
      setCredentials({
        accountId: result.accountId || credentials?.accountId || "",
        installToken: credentials?.installToken ?? "",
        workerUrl: url,
        adminToken: "",
        workerScriptName:
          result.workerScriptName || credentials?.workerScriptName || "",
        workerVersion: credentials?.workerVersion ?? "",
        relaybaseAccountId: credentials?.relaybaseAccountId ?? "",
        relaybaseEmail: credentials?.relaybaseEmail ?? "",
        relaybaseSession: credentials?.relaybaseSession ?? "",
        cfOauthAccessToken: credentials?.cfOauthAccessToken ?? "",
        cfOauthRefreshToken: credentials?.cfOauthRefreshToken ?? "",
        cfOauthAccessExpiresAt: credentials?.cfOauthAccessExpiresAt ?? "",
        cfOauthAccountId: credentials?.cfOauthAccountId ?? "",
      });
      void desktopRegisterWorkerWithConsole(url).catch(() => {
        /* best-effort */
      });
      router.replace("/");
    } catch (err) {
      setError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupCenteredPage>
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Owner login
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in with the username and passtoken issued by this Worker.
            The passtoken is not saved on this Mac.
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void handleVerify(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="worker-url">Worker URL</Label>
            <Input
              id="worker-url"
              autoFocus={!workerUrl}
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://relaybase-api.<subdomain>.workers.dev"
              className="font-mono text-xs"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-username">Username</Label>
            <Input
              id="owner-username"
              autoFocus={Boolean(workerUrl)}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="owner"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-passtoken">Passtoken</Label>
            <Input
              id="owner-passtoken"
              type="password"
              value={passtoken}
              onChange={(e) => setPasstoken(e.target.value)}
              placeholder="rb_pass_…"
              className="font-mono text-xs"
              autoComplete="current-password"
              spellCheck={false}
              required
            />
            <button
              type="button"
              className="text-left text-xs text-muted-foreground hover:underline"
              onClick={() => router.push("/setup/recover-admin")}
            >
              I forgot my passtoken
            </button>
          </div>
          <DesktopErrorBanner error={error} />
          <Button
            type="submit"
            className="w-full"
            disabled={
              busy ||
              !workerUrl.trim() ||
              !username.trim() ||
              !passtoken.trim()
            }
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </div>
    </SetupCenteredPage>
  );
}
