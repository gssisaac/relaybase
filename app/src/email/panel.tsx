"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  EmailMailboxLayout,
  type EmailMailboxSection,
} from "@/email/components/EmailMailboxLayout";
import { EmailPageSuspenseFallback } from "@/email/components/EmailPageSuspenseFallback";
import { ComposeView } from "@/email/components/ComposeView";
import { MailListView } from "@/email/components/MailListView";
import { useEmailPaths } from "@/email/paths";

function EmailsInboxRedirect() {
  const router = useRouter();
  const { inbox } = useEmailPaths();
  useEffect(() => {
    router.replace(inbox);
  }, [inbox, router]);
  return null;
}

function SuspenseMailListView({
  folder,
  messageId,
}: {
  folder: Extract<EmailMailboxSection, "inbox" | "drafts" | "sent" | "trash">;
  messageId?: string;
}) {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <MailListView folder={folder} messageId={messageId} />
    </Suspense>
  );
}

function SuspenseComposeView() {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <ComposeView />
    </Suspense>
  );
}

function mailboxSection(second?: string): EmailMailboxSection | null {
  if (
    second === "inbox" ||
    second === "drafts" ||
    second === "sent" ||
    second === "compose" ||
    second === "trash"
  ) {
    return second;
  }
  return null;
}

export function EmailMailboxRoutes({
  second,
  rest,
}: {
  second?: string;
  rest: string[];
}) {
  const section = mailboxSection(second);
  if (!section) {
    return <EmailsInboxRedirect />;
  }

  const messageId =
    rest.length > 0
      ? rest.map((segment) => decodeURIComponent(segment)).join("/")
      : undefined;

  let page: ReactNode = null;
  if (
    section === "inbox" ||
    section === "drafts" ||
    section === "sent" ||
    section === "trash"
  ) {
    page = <SuspenseMailListView folder={section} messageId={messageId} />;
  } else {
    page = <SuspenseComposeView />;
  }

  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <EmailMailboxLayout section={section}>{page}</EmailMailboxLayout>
    </Suspense>
  );
}

export function EmailsLegacyRedirect({
  second,
  rest,
}: {
  second?: string;
  rest: string[];
}) {
  const router = useRouter();
  useEffect(() => {
    const tail = [second, ...rest].filter(
      (segment): segment is string => Boolean(segment),
    );
    const path = tail.length
      ? `/email/${tail.map(encodeURIComponent).join("/")}`
      : "/email/inbox";
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    router.replace(`${path}${search}`);
  }, [rest, router, second]);
  return null;
}

export { SuspenseComposeView, SuspenseMailListView };
