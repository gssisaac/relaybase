"use client";

import { Fingerprint, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  biometryLabel,
  desktopAuthenticateBiometry,
  desktopCheckBiometry,
  type BiometryStatus,
} from "@/lib/desktop/biometry";
import {
  desktopOwnerLogin,
  desktopOwnerSessionStatus,
  desktopOwnerSetBiometryEnabled,
  desktopOwnerUnlock,
  isDesktopRuntime,
  type OwnerSessionStatus,
} from "@/lib/desktop/bridge";
import { ownerLogin } from "@/lib/desktop/owner-session";

export function OwnerUnlockPanel({
  workerUrl,
  onUnlocked,
}: {
  workerUrl: string;
  onUnlocked: () => void;
}) {
  const [status, setStatus] = useState<OwnerSessionStatus | null>(null);
  const [bio, setBio] = useState<BiometryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [passtoken, setPasstoken] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  const tryUnlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await desktopOwnerSessionStatus();
      setStatus(session);
      setUsername((prev) => prev || session.username);
      if (session.hasAccess) {
        onUnlocked();
        return;
      }
      if (!session.hasRefresh) {
        setShowLogin(true);
        return;
      }
      if (session.biometryEnabled) {
        const nextBio = await desktopCheckBiometry();
        setBio(nextBio);
        if (nextBio.isAvailable) {
          try {
            await desktopAuthenticateBiometry(
              "Unlock your Relaybase owner session",
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(
              msg ||
                "Biometric unlock failed. Sign in with your username and passtoken.",
            );
            setShowLogin(true);
            return;
          }
        }
      }
      await desktopOwnerUnlock();
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setShowLogin(true);
    } finally {
      setBusy(false);
    }
  }, [onUnlocked]);

  useEffect(() => {
    void tryUnlock();
  }, [tryUnlock]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isDesktopRuntime()) {
        await desktopOwnerLogin({
          workerUrl,
          username,
          passtoken,
          biometryEnabled: status?.biometryEnabled ?? true,
        });
      } else {
        await ownerLogin({ username, passtoken, label: "browser" });
      }
      setPasstoken("");
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const label = biometryLabel(
    bio?.biometryType ?? 0,
    status?.platform,
  );

  if (!showLogin && busy) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Fingerprint className="size-8 animate-pulse" />
        <p>Unlocking with {label}…</p>
      </div>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center p-6">
      <form
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6"
        onSubmit={(e) => void handleLogin(e)}
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Unlock Relaybase
          </h1>
          <p className="text-xs text-muted-foreground">
            {bio?.isAvailable
              ? `${label} unlock failed or was cancelled. Sign in with the passtoken you downloaded.`
              : "Enter the owner username and the passtoken you downloaded. The app does not store the passtoken."}
          </p>
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="owner-username">Username</Label>
          <Input
            id="owner-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="owner-passtoken">Passtoken</Label>
          <Input
            id="owner-passtoken"
            type="password"
            value={passtoken}
            onChange={(e) => setPasstoken(e.target.value)}
            autoComplete="off"
            required
            className="font-mono text-xs"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </Button>
        {status?.hasRefresh && bio?.isAvailable ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void tryUnlock()}
          >
            Try {label} again
          </Button>
        ) : null}
        {isDesktopRuntime() && status?.hasRefresh ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline"
            onClick={() => {
              void desktopOwnerSetBiometryEnabled(
                !(status?.biometryEnabled ?? true),
              ).then(setStatus);
            }}
          >
            {status?.biometryEnabled
              ? "Don't use biometric unlock on this device"
              : "Use biometric unlock on this device"}
          </button>
        ) : null}
      </form>
    </div>
  );
}
