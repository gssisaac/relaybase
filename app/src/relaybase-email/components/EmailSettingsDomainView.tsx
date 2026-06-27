"use client";

import Link from "next/link";

import {
  EmailAlerts,
  PageToolbar,
} from "@/relaybase-email/components/EmailShared";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useEmailSettings } from "@/relaybase-email/components/useEmailSettings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export function EmailSettingsDomainView() {
  const s = useEmailSettings();
  const { settingsKeys } = useEmailPaths();

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <PageToolbar
        refreshing={s.refreshing}
        cacheHint={s.cacheHint}
        onRefresh={() => s.refresh({ refresh: true })}
      />
      <EmailAlerts error={s.error} message={s.message} />

      <Alert>
        <AlertTitle>Domain for this product</AlertTitle>
        <AlertDescription>
          Set the sending domain used to scope API keys. Cloudflare Email Sending,
          routing, DNS, and inbound R2 are managed in Relaybase by your operator.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email domain</CardTitle>
          <CardDescription>
            Domain you send from and receive mail on. API keys in{" "}
            <Link href={settingsKeys} className="underline">
              API Keys
            </Link>{" "}
            are bound to this domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 sm:max-w-md">
            <Label className="text-xs">Email domain</Label>
            <Input
              value={s.emailDomain}
              onChange={(e) => s.setEmailDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={s.saveDomainSettings}
            disabled={s.saving || !s.emailDomain.trim()}
          >
            {s.saving ? "Saving…" : "Save domain"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
