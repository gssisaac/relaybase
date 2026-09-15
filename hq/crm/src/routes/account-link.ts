import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import { serializeAccountLink } from "../lib/account-link/serialize";
import {
  accountDefaultComplianceIdentityId,
  syncAccountComplianceMirror,
} from "../lib/compliance/identity";

export const crmAccountLink = new Hono();

// GET /crm/account-link
crmAccountLink.get("/", (c) => c.json(serializeAccountLink()));

// PATCH /crm/account-link { domain?, workerUrl?, defaultComplianceIdentityId?, compliance? }
crmAccountLink.patch("/", async (c) => {
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

  store.update((draft) => {
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
      syncAccountComplianceMirror(draft);
    }

    if (body.compliance) {
      const defaultId = accountDefaultComplianceIdentityId(draft);
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
      syncAccountComplianceMirror(draft);
    }
  });

  return c.json(serializeAccountLink());
});
