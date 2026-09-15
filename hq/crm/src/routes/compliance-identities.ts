import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { ComplianceIdentity } from "../db/types";
import {
  findComplianceIdentity,
  listComplianceIdentities,
  serializeComplianceIdentity,
  syncAccountComplianceMirror,
} from "../lib/compliance/identity";
import { newId } from "../lib/shared/ids";

export const crmComplianceIdentities = new Hono();

// GET /crm/compliance-identities
crmComplianceIdentities.get("/", (c) => {
  const identities = listComplianceIdentities().map(serializeComplianceIdentity);
  const data = store.read();
  return c.json({
    identities,
    defaultComplianceIdentityId: data.account.defaultComplianceIdentityId,
  });
});

// POST /crm/compliance-identities { name?, organizationName?, postalAddress?, contactEmail?, setAsDefault? }
crmComplianceIdentities.post("/", async (c) => {
  let body: {
    name?: string;
    organizationName?: string | null;
    postalAddress?: string | null;
    contactEmail?: string | null;
    setAsDefault?: boolean;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const org = body.organizationName?.trim() || null;
  const name = body.name?.trim() || org || "New sender";
  const now = new Date().toISOString();
  const id = newId("compliance");
  let created: ComplianceIdentity | null = null;

  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      organizationName: org,
      postalAddress: body.postalAddress?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    draft.complianceIdentities.push(created);
    if (body.setAsDefault || !draft.account.defaultComplianceIdentityId) {
      draft.account.defaultComplianceIdentityId = id;
    }
    syncAccountComplianceMirror(draft);
  });

  return c.json({ identity: serializeComplianceIdentity(created!) }, 201);
});

// PATCH /crm/compliance-identities/:id
crmComplianceIdentities.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = findComplianceIdentity(id);
  if (!existing || existing.accountLinkId !== DEV_ACCOUNT_LINK_ID) {
    return c.json({ error: "not found" }, 404);
  }

  let body: {
    name?: string;
    organizationName?: string | null;
    postalAddress?: string | null;
    contactEmail?: string | null;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const now = new Date().toISOString();
  let updated: ComplianceIdentity | null = null;
  store.update((draft) => {
    const idx = draft.complianceIdentities.findIndex((row) => row.id === id);
    if (idx < 0) return;
    const prev = draft.complianceIdentities[idx]!;
    updated = {
      ...prev,
      name: body.name !== undefined ? body.name.trim() || prev.name : prev.name,
      organizationName:
        body.organizationName !== undefined
          ? body.organizationName?.trim() || null
          : prev.organizationName,
      postalAddress:
        body.postalAddress !== undefined ? body.postalAddress?.trim() || null : prev.postalAddress,
      contactEmail:
        body.contactEmail !== undefined ? body.contactEmail?.trim() || null : prev.contactEmail,
      updatedAt: now,
    };
    draft.complianceIdentities[idx] = updated;
    if (draft.account.defaultComplianceIdentityId === id) {
      syncAccountComplianceMirror(draft);
    }
  });

  return c.json({ identity: serializeComplianceIdentity(updated!) });
});
