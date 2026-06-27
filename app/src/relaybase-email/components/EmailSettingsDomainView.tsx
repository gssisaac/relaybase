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

export function EmailSettingsDomainView() {
  const s = useEmailSettings();
  const { domains } = useEmailPaths();

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <PageToolbar
        refreshing={s.refreshing}
        cacheHint={s.cacheHint}
        onRefresh={() => s.refresh({ refresh: true })}
      />
      <EmailAlerts error={s.error} message={s.message} />

      <Alert>
        <AlertTitle>Domains moved</AlertTitle>
        <AlertDescription>
          Manage sending domains, set the active domain, and view per-domain
          counts from the Domains page.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Domains</CardTitle>
          <CardDescription>
            Add domains, switch the active domain, and scope accounts, email,
            broadcasts, and audience by domain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" render={<Link href={domains} />}>
            Open Domains
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
