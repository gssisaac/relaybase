import { TriangleAlert } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Soft cap while send still runs in one Worker request with no pause/resume. */
export const BROADCAST_BETA_MAX_RECIPIENTS = 50;

export function BroadcastBetaNotice({
  recipientCount,
}: {
  recipientCount?: number;
}) {
  const overLimit =
    recipientCount != null && recipientCount > BROADCAST_BETA_MAX_RECIPIENTS;

  return (
    <Card size="sm" className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="size-4 shrink-0" />
          Experimental beta
        </CardTitle>
        <CardDescription className="text-amber-800/80 dark:text-amber-300/80">
          {overLimit
            ? `This draft has ${recipientCount} recipients. Broadcasts currently send in one request and cannot be stopped once started. Do not send to more than ${BROADCAST_BETA_MAX_RECIPIENTS} contacts.`
            : `Broadcast is in experimental beta. Each send runs in one request and cannot be paused or cancelled once started. Do not send to more than ${BROADCAST_BETA_MAX_RECIPIENTS} contacts.`}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
