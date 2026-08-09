"use client";

import { observer } from "mobx-react-lite";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { ComposeDraftEditor } from "@/email/components/ComposeDraftEditor";
import {
  useEmailMailbox,
  useEmailMailboxStore,
} from "@/email/components/EmailMailboxContext";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import {
  buildForwardPrefill,
  buildForwardPrefillFromSent,
  domainOf,
} from "@/email/reply-helpers";
import { useEmailPaths } from "@/email/paths";

export const ComposeView = observer(function ComposeView() {
  const { inbox, drafts } = useEmailPaths();
  const { sent } = useMailboxNav();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const replyKey = searchParams.get("replyKey")?.trim() || "";
  const draftParam = searchParams.get("draft")?.trim() || "";
  const forwardKey = searchParams.get("forwardKey")?.trim() || "";
  const forwardSentId = searchParams.get("forwardSent")?.trim() || "";
  const toParam = searchParams.get("to");
  const ccParam = searchParams.get("cc");
  const subjectParam = searchParams.get("subject");
  const fromParam = searchParams.get("from");
  const inReplyToParam = searchParams.get("inReplyTo");
  const referencesParam = searchParams.get("references");

  const { addresses, accountFilter } = useEmailMailbox();
  const store = useEmailMailboxStore();
  const [forwardReady, setForwardReady] = useState(!forwardKey);

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

  useEffect(() => {
    if (!forwardKey) {
      setForwardReady(true);
      return;
    }
    let cancelled = false;
    setForwardReady(false);
    const listHit =
      store.activity.find((m) => m.key === forwardKey) ??
      store.getCachedDetail(forwardKey);
    const domain =
      (listHit ? domainOf(listHit.toEmail) : "") ||
      (accountFilter !== "all" ? domainOf(accountFilter) : "");
    void store.loadMessageDetail(forwardKey, domain).finally(() => {
      if (!cancelled) setForwardReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [accountFilter, forwardKey, store]);

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

  const forwardInitial = useMemo(() => {
    if (forwardKey) {
      const event =
        store.getCachedDetail(forwardKey) ??
        store.activity.find((m) => m.key === forwardKey);
      if (!event) return null;
      return buildForwardPrefill(event, addresses, {
        fromAccount: accountFilter,
        fromOverride: fromParam,
      });
    }
    if (forwardSentId) {
      const sentMsg =
        store.sent.find((m) => m.id === forwardSentId) ??
        store.visibleSent.find((m) => m.id === forwardSentId);
      if (!sentMsg) return null;
      return buildForwardPrefillFromSent(sentMsg, addresses, {
        fromAccount: accountFilter,
        fromOverride: fromParam,
      });
    }
    return null;
  }, [
    accountFilter,
    addresses,
    forwardKey,
    forwardSentId,
    fromParam,
    store,
    store.activity,
    store.sent,
    store.visibleSent,
    // recompute when detail cache fills
    forwardKey ? store.getCachedDetail(forwardKey) : null,
  ]);

  const initial = useMemo(() => {
    if (forwardInitial) {
      return {
        from: forwardInitial.from,
        to: forwardInitial.to,
        cc: forwardInitial.cc,
        subject: forwardInitial.subject,
        body: forwardInitial.body,
      };
    }
    return {
      from:
        fromParam?.trim() ||
        (accountFilter !== "all" ? accountFilter : "") ||
        "",
      to: toParam?.trim() || "",
      cc: ccParam?.trim() || "",
      subject: subjectParam?.trim() || "",
      body: "",
    };
  }, [accountFilter, ccParam, forwardInitial, fromParam, subjectParam, toParam]);

  const threading = useMemo(
    () => ({
      inReplyTo: inReplyToParam?.trim() || undefined,
      references: referencesParam?.trim() || undefined,
    }),
    [inReplyToParam, referencesParam],
  );

  const onAfterDiscard = useCallback(() => {
    if (forwardKey) {
      router.push(`${inbox}/${encodeURIComponent(forwardKey)}`);
      return;
    }
    if (forwardSentId) {
      router.push(`${sent}/${encodeURIComponent(forwardSentId)}`);
      return;
    }
    router.push(inbox);
  }, [forwardKey, forwardSentId, inbox, router, sent]);

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

  if ((forwardKey || forwardSentId) && (!forwardReady || !forwardInitial)) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isForward = Boolean(forwardKey || forwardSentId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <h1 className="text-sm font-semibold">
          {isForward ? "Forward" : "Compose email"}
        </h1>
      </DesktopTitleBar>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <ComposeDraftEditor
          key={
            forwardKey
              ? `fwd:${forwardKey}`
              : forwardSentId
                ? `fwds:${forwardSentId}`
                : "compose"
          }
          initial={initial}
          threading={isForward ? undefined : threading}
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
});
