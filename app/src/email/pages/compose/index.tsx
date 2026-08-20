"use client";

import { EmailMailboxLayout } from "@/email/components/mailbox/EmailMailboxLayout";
import { EmailPageSuspenseFallback } from "@/email/components/mailbox/EmailPageSuspenseFallback";
import { ComposeView } from "@/email/components/compose/ComposeView";
import { Suspense } from "react";

export function ComposePage() {
  return (
    <EmailMailboxLayout section="compose">
      <Suspense fallback={<EmailPageSuspenseFallback />}>
        <ComposeView />
      </Suspense>
    </EmailMailboxLayout>
  );
}
