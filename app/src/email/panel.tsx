"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  EmailMailboxLayout,
  type EmailMailboxSection,
} from "@/email/components/EmailMailboxLayout";
import { EmailPageSuspenseFallback } from "@/email/components/EmailPageSuspenseFallback";
import { ComposeView } from "@/email/components/ComposeView";
import { MailListView } from "@/email/components/MailListView";
import { EmailSettingsView } from "@/email/components/EmailSettingsView";
import { emailMessageIdFromSearch, useEmailPaths } from "@/email/paths";

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

function SuspenseEmailSettingsView() {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <EmailSettingsView />
    </Suspense>
  );
}

function mailboxSection(second?: string): EmailMailboxSection | null {
  if (
    second === "inbox" ||
    second === "drafts" ||
    second === "sent" ||
    second === "compose" ||
    second === "trash" ||
    second === "settings"
  ) {
    return second;
  }
  return null;
}

function EmailMailboxRoutesInner({
  second,
  rest,
}: {
  second?: string;
  rest: string[];
}) {
  const searchParams = useSearchParams();
  const section = mailboxSection(second);
  if (!section) {
    return <EmailsInboxRedirect />;
  }

  // Packaged static export only has section roots; selection is `?m=`.
  // Path segments remain as a tauri/dev fallback.
  const messageId = emailMessageIdFromSearch(searchParams, rest);

  let page: ReactNode = null;
  if (section === "settings") {
    page = <SuspenseEmailSettingsView />;
  } else if (
    section === "inbox" ||
    section === "drafts" ||
    section === "sent" ||
    section === "trash"
  ) {
    page = <SuspenseMailListView folder={section} messageId={messageId} />;
  } else {
    page = <SuspenseComposeView />;
  }

  return <EmailMailboxLayout section={section}>{page}</EmailMailboxLayout>;
}

export function EmailMailboxRoutes({
  second,
  rest,
}: {
  second?: string;
  rest: string[];
}) {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <EmailMailboxRoutesInner second={second} rest={rest} />
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
