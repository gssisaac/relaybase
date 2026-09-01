"use client";

import { observer } from "mobx-react-lite";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { ComposeDraftEditor } from "@/email/components/compose/ComposeDraftEditor";
import {
  useEmailMailbox,
  useEmailMailboxStore,
} from "@/email/components/mailbox/EmailMailboxContext";
import { useMailboxNav } from "@/email/components/mailbox/MailboxNavContext";
import {
  buildForwardPrefill,
  buildForwardPrefillFromSent,
  domainOf,
} from "@/email/lib/reply/reply-helpers";
import { emailMessageHref, useEmailPaths } from "@/email/lib/paths";

/**
 * Renders compose from URL only — open/resume/force-new policy lives in
 * `@/email/compose-open`. Callers must navigate with the right query
 * (`?new=1`, `?draft=`, `?forwardKey=`, …).
 */
export const ComposeView = observer(function ComposeView() {
  const { inbox, drafts } = useEmailPaths();
  const { sent } = useMailboxNav();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const replyKey = searchParams.get("replyKey")?.trim() || "";
  const draftParam = searchParams.get("draft")?.trim() || "";
  const forceNew = searchParams.get("new") === "1";
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

  const draftFromParam = draftParam ? store.getDraft(draftParam) : null;
  const standaloneDraft =
    draftFromParam &&
    !draftFromParam.replyKey?.trim() &&
    !draftFromParam.forwardKey?.trim()
      ? draftFromParam
      : null;
  const redirectDraftAway =
    Boolean(draftParam) &&
    Boolean(draftFromParam) &&
    !standaloneDraft;

  // Old reply links → inbox message detail (`?m=`)
  useEffect(() => {
    if (!isReply || !replyKey) return;
    router.replace(
      emailMessageHref(inbox, replyKey, {
        account: accountFilter,
        params: {
          reply: "1",
          replyAll: searchParams.get("replyAll") === "1" ? "1" : undefined,
        },
      }),
    );
  }, [accountFilter, inbox, isReply, replyKey, router, searchParams]);

  // Reply/forward drafts opened via ?draft= → drafts folder editor
  useEffect(() => {
    if (!redirectDraftAway || !draftParam) return;
    router.replace(
      emailMessageHref(drafts, draftParam, { account: accountFilter }),
    );
  }, [accountFilter, draftParam, drafts, redirectDraftAway, router]);

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

  useEffect(() => {
    if (!forwardSentId) return;
    const listHit =
      store.sent.find((m) => m.id === forwardSentId) ??
      store.visibleSent.find((m) => m.id === forwardSentId);
    const domain =
      (listHit ? domainOf(listHit.from) : "") ||
      (accountFilter !== "all" ? domainOf(accountFilter) : "");
    if (!domain) return;
    void store.loadSentDetail(forwardSentId, domain);
  }, [accountFilter, forwardSentId, store]);

  const fromFallbacks = useMemo(() => {
    const list: string[] = [];
    const fromQuery = fromParam?.trim();
    if (fromQuery) list.push(fromQuery);
    if (accountFilter !== "all") list.push(accountFilter);
    if (standaloneDraft?.from) list.push(standaloneDraft.from);
    return list;
  }, [accountFilter, fromParam, standaloneDraft?.from]);

  const fromSpecified = Boolean(
    (fromParam?.trim() &&
      addresses.some((a) => a.email === fromParam.trim())) ||
      (accountFilter !== "all" &&
        addresses.some((a) => a.email === accountFilter)) ||
      (standaloneDraft?.from &&
        addresses.some((a) => a.email === standaloneDraft.from)),
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
        store.getCachedSentDetail(forwardSentId) ??
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
    forwardSentId ? store.getCachedSentDetail(forwardSentId) : null,
  ]);

  const initial = useMemo(() => {
    if (forwardInitial) {
      return {
        from: forwardInitial.from,
        to: forwardInitial.to,
        cc: forwardInitial.cc,
        subject: forwardInitial.subject,
        body: forwardInitial.body,
        attachments: forwardInitial.attachments ?? [],
      };
    }
    if (standaloneDraft) {
      return {
        from: standaloneDraft.from,
        to: standaloneDraft.to,
        cc: standaloneDraft.cc ?? "",
        subject: standaloneDraft.subject,
        body: standaloneDraft.body,
        attachments: standaloneDraft.attachments ?? [],
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
      attachments: [],
    };
  }, [
    accountFilter,
    ccParam,
    forwardInitial,
    fromParam,
    standaloneDraft,
    subjectParam,
    toParam,
  ]);

  const threading = useMemo(
    () => ({
      inReplyTo: inReplyToParam?.trim() || undefined,
      references: referencesParam?.trim() || undefined,
    }),
    [inReplyToParam, referencesParam],
  );

  const onBack = useCallback(() => {
    if (forwardKey) {
      router.push(emailMessageHref(inbox, forwardKey, { account: accountFilter }));
      return;
    }
    if (forwardSentId) {
      router.push(
        emailMessageHref(sent, forwardSentId, { account: accountFilter }),
      );
      return;
    }
    router.push(inbox);
  }, [accountFilter, forwardKey, forwardSentId, inbox, router, sent]);

  const onAfterDiscard = useCallback(() => {
    onBack();
  }, [onBack]);

  const onAfterSend = useCallback(
    ({ from }: { from: string }) => {
      const sentParams = new URLSearchParams({ sent: "1" });
      sentParams.set("account", from);
      router.push(`${sent}?${sentParams.toString()}`);
    },
    [router, sent],
  );

  if ((isReply && replyKey) || redirectDraftAway) {
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
            standaloneDraft
              ? `draft:${standaloneDraft.id}`
              : forwardKey
                ? `fwd:${forwardKey}`
                : forwardSentId
                  ? `fwds:${forwardSentId}`
                  : forceNew
                    ? "compose-new"
                    : "compose"
          }
          draftId={standaloneDraft?.id}
          initial={initial}
          forwardKey={forwardKey || undefined}
          threading={isForward ? undefined : threading}
          addresses={addresses}
          fromFallbacks={fromFallbacks}
          allowFromSelect={!fromSpecified}
          skipAutosaveWhenEmpty
          navigateOnSendStart
          onAfterDiscard={onAfterDiscard}
          onAfterSend={onAfterSend}
          onEscape={onBack}
        />
      </div>
    </div>
  );
});
