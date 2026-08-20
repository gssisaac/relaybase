"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import {
  EmailMailboxLayout,
  type EmailMailboxSection,
} from "@/email/components/mailbox/EmailMailboxLayout";
import { EmailPageSuspenseFallback } from "@/email/components/mailbox/EmailPageSuspenseFallback";
import { MailListView } from "@/email/components/mailbox/MailListView";
import { emailMessageIdFromSearch } from "@/email/lib/paths";

type MailFolder = Extract<
  EmailMailboxSection,
  "inbox" | "drafts" | "sent" | "trash"
>;

function MailFolderPageInner({ folder }: { folder: MailFolder }) {
  const searchParams = useSearchParams();
  const messageId = emailMessageIdFromSearch(searchParams, []);
  return (
    <EmailMailboxLayout section={folder}>
      <MailListView folder={folder} messageId={messageId} />
    </EmailMailboxLayout>
  );
}

export function MailFolderPage({ folder }: { folder: MailFolder }) {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <MailFolderPageInner folder={folder} />
    </Suspense>
  );
}

export function SuspensePage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>{children}</Suspense>
  );
}
