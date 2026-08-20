"use client";

import { EmailMailboxLayout } from "@/email/components/mailbox/EmailMailboxLayout";
import { EmailPageSuspenseFallback } from "@/email/components/mailbox/EmailPageSuspenseFallback";
import { EmailSettingsView } from "@/email/components/settings/EmailSettingsView";
import { Suspense } from "react";

export function EmailSettingsPage() {
  return (
    <EmailMailboxLayout section="settings">
      <Suspense fallback={<EmailPageSuspenseFallback />}>
        <EmailSettingsView />
      </Suspense>
    </EmailMailboxLayout>
  );
}
