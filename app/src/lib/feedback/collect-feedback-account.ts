"use client";

import type { FeedbackAccountContext } from "@/lib/feedback/feedback-account";
import type { AppSessionPhase } from "@/lib/desktop/app-session/types";

export function collectFeedbackAccountContext(input: {
  productId: string;
  phase: AppSessionPhase;
  workerUrl?: string | null;
  accountEmail?: string | null;
  enabledMailAccounts?: string[];
  studioSignedIn: boolean;
  cloudAccountId?: string | null;
  cloudAccountName?: string | null;
}): FeedbackAccountContext {
  const role =
    input.phase.kind === "ownerReady"
      ? "owner"
      : input.phase.kind === "invitedReady"
        ? "invited"
        : "none";

  const ctx: FeedbackAccountContext = {
    productId: input.productId || undefined,
    sessionRole: role,
    studioSignedIn: input.studioSignedIn,
  };

  if (input.workerUrl?.trim()) ctx.workerUrl = input.workerUrl.trim();
  if (input.accountEmail?.trim()) {
    ctx.accountEmail = input.accountEmail.trim().toLowerCase();
  }
  if (input.enabledMailAccounts?.length) {
    ctx.enabledMailAccounts = input.enabledMailAccounts.slice(0, 32);
  }
  if (input.cloudAccountId?.trim()) {
    ctx.cloudAccountId = input.cloudAccountId.trim();
  }
  if (input.cloudAccountName?.trim()) {
    ctx.cloudAccountName = input.cloudAccountName.trim();
  }

  return ctx;
}
