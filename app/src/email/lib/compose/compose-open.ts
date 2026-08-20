"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import type { EmailAccountFilter } from "@/email/components/accounts/EmailAccountSelect";
import {
  useEmailMailbox,
  useEmailMailboxStore,
} from "@/email/components/mailbox/EmailMailboxContext";
import type { EmailMailboxStore } from "@/email/lib/mailbox/email-mailbox-store";
import {
  emailComposeHref,
  emailMessageHref,
  useEmailPaths,
} from "@/email/lib/paths";

type ComposeOpenIntent =
  | { kind: "compose"; intent: "resume" | "new" }
  | {
      kind: "reply" | "replyAll" | "forward";
      intent: "resume" | "new";
      inboundKey: string;
    }
  | { kind: "exact-draft"; draftId: string }
  | { kind: "forward-sent"; sentId: string };

type ComposeOpenCtx = {
  store: EmailMailboxStore;
  account: EmailAccountFilter;
  compose: string;
  inbox: string;
};

/**
 * Policy: build the href for a compose/reply/forward open.
 * Not exported — callers use adapter hooks / `composeNewHref` only.
 */
function composeOpenHref(
  intent: ComposeOpenIntent,
  ctx: ComposeOpenCtx,
): string {
  switch (intent.kind) {
    case "compose": {
      if (intent.intent === "new") {
        return emailComposeHref(ctx.account, {
          base: ctx.compose,
          forceNew: true,
        });
      }
      const draftId =
        ctx.store.findResumableComposeDraft("compose")?.id ?? null;
      return emailComposeHref(ctx.account, {
        base: ctx.compose,
        draftId,
      });
    }
    case "reply":
    case "replyAll": {
      const draftId =
        intent.intent === "new"
          ? crypto.randomUUID()
          : (ctx.store.findResumableComposeDraft(
              intent.kind,
              intent.inboundKey,
            )?.id ?? undefined);
      return emailMessageHref(ctx.inbox, intent.inboundKey, {
        account: ctx.account,
        params: {
          [intent.kind === "replyAll" ? "replyAll" : "reply"]: "1",
          draftId,
        },
      });
    }
    case "forward": {
      const params = new URLSearchParams();
      if (ctx.account && ctx.account !== "all") {
        params.set("account", ctx.account);
      }
      params.set("forwardKey", intent.inboundKey);
      return `${ctx.compose}?${params.toString()}`;
    }
    case "forward-sent": {
      const params = new URLSearchParams();
      if (ctx.account && ctx.account !== "all") {
        params.set("account", ctx.account);
      }
      params.set("forwardSent", intent.sentId);
      return `${ctx.compose}?${params.toString()}`;
    }
    case "exact-draft": {
      return emailComposeHref(ctx.account, {
        base: ctx.compose,
        draftId: intent.draftId,
      });
    }
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

/** Link href for nav / toolbar — always a fresh standalone compose. */
export function composeNewHref(account?: string | null): string {
  return emailComposeHref(account, { forceNew: true });
}

/** Open an existing standalone draft in the compose view. */
export function exactDraftComposeHref(
  draftId: string,
  account?: string | null,
): string {
  return emailComposeHref(account, { draftId });
}

/**
 * Draft id for inline thread composer (keyboard r/a/f on open thread).
 * Resume matching draft when present; otherwise a new id.
 */
export function resumeOrNewThreadDraftId(
  store: EmailMailboxStore,
  mode: "reply" | "replyAll" | "forward",
  inboundKey: string,
): string {
  return (
    store.findResumableComposeDraft(mode, inboundKey)?.id ?? crypto.randomUUID()
  );
}

/**
 * Draft id when opening via `?reply=` / `?replyAll=` / `?draftId=`.
 * Preferred id wins; else resume; else new.
 */
export function resolveReplyOpenDraftId(
  store: EmailMailboxStore,
  mode: "reply" | "replyAll",
  inboundKey: string,
  preferredDraftId?: string | null,
): string {
  const preferred = preferredDraftId?.trim();
  if (preferred) return preferred;
  return resumeOrNewThreadDraftId(store, mode, inboundKey);
}

function useComposeOpenCtx(): ComposeOpenCtx {
  const store = useEmailMailboxStore();
  const { accountFilter } = useEmailMailbox();
  const { compose, inbox } = useEmailPaths();
  return useMemo(
    () => ({
      store,
      account: accountFilter,
      compose,
      inbox,
    }),
    [accountFilter, compose, inbox, store],
  );
}

/** Standalone compose opener (nav / toolbar / keyboard c / Cmd+K). */
export function useStandaloneComposeOpener(): {
  openCompose: () => void;
  openComposeNew: () => void;
  hasResumableDraft: boolean;
  /** Href for Link buttons that must always open a blank compose. */
  composeNewHref: string;
} {
  const router = useRouter();
  const ctx = useComposeOpenCtx();
  const hasResumableDraft = Boolean(
    ctx.store.findResumableComposeDraft("compose"),
  );

  const openCompose = useCallback(() => {
    router.push(composeOpenHref({ kind: "compose", intent: "resume" }, ctx));
  }, [ctx, router]);

  const openComposeNew = useCallback(() => {
    router.push(composeOpenHref({ kind: "compose", intent: "new" }, ctx));
  }, [ctx, router]);

  const newHref = useMemo(
    () => composeOpenHref({ kind: "compose", intent: "new" }, ctx),
    [ctx],
  );

  return {
    openCompose,
    openComposeNew,
    hasResumableDraft,
    composeNewHref: newHref,
  };
}

/**
 * Thread reply/forward opener.
 * - `openReply` / `openForward` / `openForwardSent` navigate (Cmd+K / URL paths)
 * - `resumeOrNewDraftId` is for inline thread composer (keyboard on open thread)
 */
export function useThreadComposeOpener(): {
  openReply: (inboundKey: string, mode: "reply" | "replyAll") => void;
  openForward: (inboundKey: string) => void;
  openForwardSent: (sentId: string) => void;
  openExactDraft: (draftId: string) => void;
  resumeOrNewDraftId: (
    mode: "reply" | "replyAll" | "forward",
    inboundKey: string,
  ) => string;
} {
  const router = useRouter();
  const ctx = useComposeOpenCtx();

  const openReply = useCallback(
    (inboundKey: string, mode: "reply" | "replyAll") => {
      router.push(
        composeOpenHref(
          { kind: mode, intent: "resume", inboundKey },
          ctx,
        ),
      );
    },
    [ctx, router],
  );

  const openForward = useCallback(
    (inboundKey: string) => {
      router.push(
        composeOpenHref(
          { kind: "forward", intent: "resume", inboundKey },
          ctx,
        ),
      );
    },
    [ctx, router],
  );

  const openForwardSent = useCallback(
    (sentId: string) => {
      router.push(composeOpenHref({ kind: "forward-sent", sentId }, ctx));
    },
    [ctx, router],
  );

  const openExactDraft = useCallback(
    (draftId: string) => {
      router.push(composeOpenHref({ kind: "exact-draft", draftId }, ctx));
    },
    [ctx, router],
  );

  const resumeOrNewDraftId = useCallback(
    (mode: "reply" | "replyAll" | "forward", inboundKey: string) =>
      resumeOrNewThreadDraftId(ctx.store, mode, inboundKey),
    [ctx.store],
  );

  return {
    openReply,
    openForward,
    openForwardSent,
    openExactDraft,
    resumeOrNewDraftId,
  };
}
