import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";

export const crmAccountLink = new Hono();

function serialize() {
  const account = store.read().account;
  return {
    id: account.id,
    workerUrl: account.workerUrl,
    domain: account.domain,
    compliance: account.compliance,
    createdAt: account.createdAt,
  };
}

// GET /crm/account-link
crmAccountLink.get("/", (c) => c.json(serialize()));

// PATCH /crm/account-link { domain?, workerUrl?, compliance? }
crmAccountLink.patch("/", async (c) => {
  let body: {
    domain?: string;
    workerUrl?: string;
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

  store.update((draft) => {
    if (draft.account.id !== DEV_ACCOUNT_LINK_ID) return;
    if (domain !== undefined) draft.account.domain = domain;
    if (workerUrl !== undefined) draft.account.workerUrl = workerUrl;
    if (body.compliance) {
      const cpl = draft.account.compliance;
      if (body.compliance.organizationName !== undefined) {
        cpl.organizationName = body.compliance.organizationName?.trim() || null;
      }
      if (body.compliance.postalAddress !== undefined) {
        cpl.postalAddress = body.compliance.postalAddress?.trim() || null;
      }
      if (body.compliance.contactEmail !== undefined) {
        cpl.contactEmail = body.compliance.contactEmail?.trim() || null;
      }
      cpl.updatedAt = new Date().toISOString();
    }
  });

  return c.json(serialize());
});
