import {
  DEV_ACCOUNT_LINK_ID,
  accountService,
  studioDocumentService,
} from "@services/index";

import { Hono } from "hono";

export const studioAccountLink = new Hono();

// GET /studio/account-link
studioAccountLink.get("/", (c) => c.json(accountService.serializeAccountLink()));

// PATCH /studio/account-link { domain?, workerUrl?, defaultComplianceIdentityId?, compliance? }
studioAccountLink.patch("/", async (c) => {
  let body: {
    domain?: string;
    workerUrl?: string;
    sendApiKey?: string | null;
    defaultComplianceIdentityId?: string | null;
    compliance?: {
      organizationName?: string | null;
      postalAddress?: string | null;
      contactEmail?: string | null;
    };
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }

  const domain =
    body.domain === undefined ? undefined : body.domain.trim().toLowerCase() || null;
  const workerUrl =
    body.workerUrl === undefined
      ? undefined
      : body.workerUrl.trim().replace(/\/$/, "") || null;
  const sendApiKey =
    body.sendApiKey === undefined
      ? undefined
      : body.sendApiKey?.trim() || null;

  studioDocumentService.mutate((draft) => {
    if (draft.account.id !== DEV_ACCOUNT_LINK_ID) return;
    if (domain !== undefined) draft.account.domain = domain;
    if (workerUrl !== undefined) draft.account.workerUrl = workerUrl;
    if (sendApiKey !== undefined) draft.account.sendApiKey = sendApiKey;

    if (body.defaultComplianceIdentityId !== undefined) {
      const next = body.defaultComplianceIdentityId?.trim() || null;
      if (next && !draft.complianceIdentities.some((row) => row.id === next)) {
        return;
      }
      draft.account.defaultComplianceIdentityId = next;
      accountService.syncComplianceMirror(draft);
    }

    if (body.compliance) {
      const defaultId = accountService.defaultComplianceIdentityId(draft);
      const idx = draft.complianceIdentities.findIndex((row) => row.id === defaultId);
      if (idx < 0) return;
      const prev = draft.complianceIdentities[idx]!;
      const now = new Date().toISOString();
      if (body.compliance.organizationName !== undefined) {
        prev.organizationName = body.compliance.organizationName?.trim() || null;
      }
      if (body.compliance.postalAddress !== undefined) {
        prev.postalAddress = body.compliance.postalAddress?.trim() || null;
      }
      if (body.compliance.contactEmail !== undefined) {
        prev.contactEmail = body.compliance.contactEmail?.trim() || null;
      }
      prev.updatedAt = now;
      draft.complianceIdentities[idx] = prev;
      accountService.syncComplianceMirror(draft);
    }
  });

  return c.json(accountService.serializeAccountLink());
});
