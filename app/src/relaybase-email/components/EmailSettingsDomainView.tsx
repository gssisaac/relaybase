"use client";

import Link from "next/link";

import {
  EmailAlerts,
  PageToolbar,
} from "@/relaybase-email/components/EmailShared";
import { WorkerUpdatePanel } from "@/relaybase-email/components/WorkerUpdatePanel";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useEmailSettings } from "@/relaybase-email/components/useEmailSettings";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmailSettingsDomainView() {
  const s = useEmailSettings();
  const { domains } = useEmailPaths();
  const desktop = typeof window !== "undefined" && isDesktopRuntime();

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <PageToolbar
        refreshing={s.refreshing}
        cacheHint={s.cacheHint}
        onRefresh={() => s.refresh({ refresh: true })}
      />
      <EmailAlerts error={s.error} message={s.message} />

      <Alert>
        <AlertTitle>Domains</AlertTitle>
        <AlertDescription>
          Manage sending domains on your Cloudflare account from the Domains
          page. Relaybase does not host nameservers for you.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Domains</CardTitle>
          <CardDescription>
            Add or import zones, switch the active domain, and scope accounts
            and email by domain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" render={<Link href={domains} />}>
            Open Domains
          </Button>
        </CardContent>
      </Card>

      {desktop ? <WorkerUpdatePanel /> : null}
    </div>
  );
}
