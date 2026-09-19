import { Hono } from "hono";
import {
  accountService,
  analyticsService,
  assetService,
  DEV_ACCOUNT_LINK_ID,
  messageService,
  newsletterService,
  subscriberGroupService,
  studioDocumentService,
  templateService,
  trackingService,
  triggerService,
} from "@services/index";

import type { ComplianceIdentity } from "@db/types";
import { newId } from "@lib/shared/ids";
export const studioComplianceIdentities = new Hono();

// GET /studio/compliance-identities
studioComplianceIdentities.get("/", (c) => {
  const identities = accountService.listComplianceIdentities().map((row) => accountService.serializeComplianceIdentity(row));
  const data = studioDocumentService.read();
  return c.json({
    identities,
    defaultComplianceIdentityId: data.account.defaultComplianceIdentityId,
  });
});

// POST /studio/compliance-identities { name?, organizationName?, postalAddress?, contactEmail?, setAsDefault? }
studioComplianceIdentities.post("/", async (c) => {
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

  studioDocumentService.mutate((draft) => {
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
    accountService.syncComplianceMirror(draft);
  });

  return c.json({ identity: accountService.serializeComplianceIdentity(created!) }, 201);
});

// PATCH /studio/compliance-identities/:id
studioComplianceIdentities.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = accountService.findComplianceIdentity(id);
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
  studioDocumentService.mutate((draft) => {
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
      accountService.syncComplianceMirror(draft);
    }
  });

  return c.json({ identity: accountService.serializeComplianceIdentity(updated!) });
});
