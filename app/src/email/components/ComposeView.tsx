"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { ComposeDraftEditor } from "@/email/components/ComposeDraftEditor";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import { useEmailPaths } from "@/email/paths";

export function ComposeView() {
  const { inbox, drafts } = useEmailPaths();
  const { sent } = useMailboxNav();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const replyKey = searchParams.get("replyKey")?.trim() || "";
  const draftParam = searchParams.get("draft")?.trim() || "";
  const toParam = searchParams.get("to");
  const ccParam = searchParams.get("cc");
  const subjectParam = searchParams.get("subject");
  const fromParam = searchParams.get("from");
  const inReplyToParam = searchParams.get("inReplyTo");
  const referencesParam = searchParams.get("references");

  const { addresses, accountFilter } = useEmailMailbox();

  // Old reply links → inbox message sub-page
  useEffect(() => {
    if (!isReply || !replyKey) return;
    const params = new URLSearchParams();
    if (accountFilter !== "all") {
      params.set("account", accountFilter);
    }
    params.set("reply", "1");
    if (searchParams.get("replyAll") === "1") {
      params.set("replyAll", "1");
    }
    const qs = params.toString();
    router.replace(
      `${inbox}/${encodeURIComponent(replyKey)}${qs ? `?${qs}` : ""}`,
    );
  }, [accountFilter, inbox, isReply, replyKey, router, searchParams]);

  // Legacy ?draft= → /email/drafts/:id
  useEffect(() => {
    if (!draftParam) return;
    const params = new URLSearchParams();
    if (accountFilter !== "all") {
      params.set("account", accountFilter);
    }
    const qs = params.toString();
    router.replace(
      `${drafts}/${encodeURIComponent(draftParam)}${qs ? `?${qs}` : ""}`,
    );
  }, [accountFilter, draftParam, drafts, router]);

  const fromFallbacks = useMemo(() => {
    const list: string[] = [];
    const fromQuery = fromParam?.trim();
    if (fromQuery) list.push(fromQuery);
    if (accountFilter !== "all") list.push(accountFilter);
    return list;
  }, [accountFilter, fromParam]);

  const fromSpecified = Boolean(
    (fromParam?.trim() &&
      addresses.some((a) => a.email === fromParam.trim())) ||
      (accountFilter !== "all" &&
        addresses.some((a) => a.email === accountFilter)),
  );

  const initial = useMemo(
    () => ({
      from: "",
      to: toParam?.trim() || "",
      cc: ccParam?.trim() || "",
      subject: subjectParam?.trim() || "",
      body: "",
    }),
    [ccParam, subjectParam, toParam],
  );

  const threading = useMemo(
    () => ({
      inReplyTo: inReplyToParam?.trim() || undefined,
      references: referencesParam?.trim() || undefined,
    }),
    [inReplyToParam, referencesParam],
  );

  const onAfterDiscard = useCallback(() => {
    router.push(inbox);
  }, [inbox, router]);

  const onAfterSend = useCallback(
    ({ from }: { from: string }) => {
      const sentParams = new URLSearchParams({ sent: "1" });
      sentParams.set("account", from);
      router.push(`${sent}?${sentParams.toString()}`);
    },
    [router, sent],
  );

  if ((isReply && replyKey) || draftParam) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <h1 className="text-sm font-semibold">Compose email</h1>
      </DesktopTitleBar>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <ComposeDraftEditor
          initial={initial}
          threading={threading}
          addresses={addresses}
          fromFallbacks={fromFallbacks}
          allowFromSelect={!fromSpecified}
          skipAutosaveWhenEmpty
          navigateOnSendStart
          onAfterDiscard={onAfterDiscard}
          onAfterSend={onAfterSend}
        />
      </div>
    </div>
  );
}
