"use client";

import { Loader2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useSettingsConnection } from "@/dashboard/components/settings/SettingsConnectionContext";
import { SettingsPageBody } from "@/dashboard/components/settings/settings-shared";

export function SettingsAdminTokenPage() {
  const {
    credentials,
    recoveryToken,
    setRecoveryToken,
    newAdminToken,
    setNewAdminToken,
    recoveryBusy,
    recoveryError,
    recoveryMessage,
    handleRequestRecoveryToken,
    handleRecoverAdmin,
  } = useSettingsConnection();

  return (
    <SettingsPageBody>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <CardTitle className="text-sm">Reset admin token</CardTitle>
          </div>
          <CardDescription>
            Lost your ADMIN_TOKEN? Request a one-time recovery token from the
            Relaybase console (emailed to your account address), then set a new
            admin token here — no Wrangler needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recovery-token">Recovery token</Label>
            <Input
              id="recovery-token"
              value={recoveryToken}
              onChange={(e) => setRecoveryToken(e.target.value)}
              placeholder="token from your email"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-admin-token">New admin token</Label>
            <Input
              id="new-admin-token"
              type="password"
              value={newAdminToken}
              onChange={(e) => setNewAdminToken(e.target.value)}
              placeholder="rb_admin_… (min 16 chars)"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <DesktopErrorBanner error={recoveryError} />
          {recoveryMessage ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {recoveryMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={recoveryBusy || !credentials?.relaybaseSession}
              onClick={() => void handleRequestRecoveryToken()}
            >
              {recoveryBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Request recovery token
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                recoveryBusy ||
                !recoveryToken.trim() ||
                !newAdminToken.trim() ||
                !credentials?.workerUrl
              }
              onClick={() => void handleRecoverAdmin()}
            >
              Reset admin token
            </Button>
          </div>
          {!credentials?.relaybaseSession ? (
            <p className="text-[11px] text-muted-foreground">
              Sign in to your Relaybase account to use admin token recovery.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </SettingsPageBody>
  );
}
