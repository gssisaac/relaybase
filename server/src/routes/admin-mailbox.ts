import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { createCloudflareClient } from "../lib/cloudflare-config";
import {
  ensureInboundWorkerRouting,
  removeInboundWorkerRouting,
} from "../lib/inbound-routing";
import {
  addDomain,
  listDomainSummaries,
  normalizeDomain,
  readMailbox,
  removeAddress,
  removeDomain,
  upsertAddresses,
  writeMailbox,
  type MailboxAddress,
} from "../lib/catalog-store";

const adminMailbox = new Hono<{ Bindings: Env }>();

/** Full mailbox blob (domains + addresses). */
adminMailbox.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const data = await readMailbox(c.env.RELAYBASE_APP);
  return c.json(data);
});

adminMailbox.put("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  let body: { domains?: string[]; addresses?: MailboxAddress[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domains = Array.isArray(body.domains)
    ? [
        ...new Set(
          body.domains
            .filter((d): d is string => typeof d === "string")
            .map(normalizeDomain)
            .filter(Boolean),
        ),
      ].sort()
    : [];
  const addresses = Array.isArray(body.addresses)
    ? body.addresses
        .filter(
          (a): a is MailboxAddress =>
            !!a &&
            typeof a === "object" &&
            typeof a.email === "string" &&
            typeof a.domain === "string",
        )
        .map((a) => ({
          email: a.email.trim().toLowerCase(),
          domain: normalizeDomain(a.domain),
          ...(typeof a.displayName === "string" && a.displayName.trim()
            ? { displayName: a.displayName.trim() }
            : {}),
        }))
    : [];
  const data = { domains, addresses };
  await writeMailbox(c.env.RELAYBASE_APP, data);
  return c.json(data);
});

/** Config subset for EmailMailboxStore. */
adminMailbox.get("/config", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const data = await readMailbox(c.env.RELAYBASE_APP);
  const domains = data.domains;
  const emailDomain = domains[0] ?? "";
  return c.json({
    emailDomain,
    domain: emailDomain,
    domains,
    activeDomain: emailDomain || null,
    registeredAddresses: data.addresses.map((a) => a.email),
    configured: domains.length > 0,
    relaybaseConfigured: true,
    relaybaseAuthConfigured: true,
    cloudflareConfigured: true,
    credentialSource: "integration",
    usesIntegrationCredentials: true,
    emailZoneId: "",
    relaybaseApiKey: "",
    relaybaseAuthToken: "",
    relaybaseKeyId: "",
    cloudflareAccountId: "",
    cloudflareApiToken: "",
    cloudflareDnsApiToken: "",
    cloudflareApiEmail: "",
    cloudflareGlobalApiKey: "",
    audienceContacts: [],
    broadcasts: [],
    relaybaseWorkerUrl: "",
  });
});

export { adminMailbox };

const adminDomains = new Hono<{ Bindings: Env }>();

adminDomains.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const data = await readMailbox(c.env.RELAYBASE_APP);
  return c.json({ domains: listDomainSummaries(data) });
});

adminDomains.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  let body: { domain?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const data = await addDomain(c.env.RELAYBASE_APP, body.domain ?? "");
    const domain = normalizeDomain(body.domain ?? "");
    const summaries = listDomainSummaries(data);
    return c.json({
      domains: summaries,
      onboarding: summaries.find((d) => d.domain === domain)?.onboarding ?? null,
      message: `Added ${domain}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

adminDomains.delete("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  const data = await removeDomain(c.env.RELAYBASE_APP, domain);
  return c.json({
    domains: listDomainSummaries(data),
    message: "Domain removed",
  });
});

export { adminDomains };

const adminAddresses = new Hono<{ Bindings: Env }>();

adminAddresses.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const data = await readMailbox(c.env.RELAYBASE_APP);
  if (c.req.query("all") === "1") {
    return c.json({ addresses: data.addresses });
  }
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) {
    return c.json({ error: "domain query required" }, 400);
  }
  if (!data.domains.includes(domain)) {
    return c.json({ error: "Domain not found" }, 404);
  }
  return c.json({
    addresses: data.addresses.filter((a) => a.domain === domain),
  });
});

adminAddresses.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: {
    localPart?: string;
    localParts?: string[];
    displayName?: string;
    displayNames?: Record<string, string>;
    domain?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const domain = normalizeDomain(
    body.domain ?? c.req.query("domain") ?? "",
  );
  if (!domain) {
    return c.json(
      { error: "Select a domain before adding senders" },
      400,
    );
  }

  const localParts = (
    Array.isArray(body.localParts) && body.localParts.length
      ? body.localParts
      : body.localPart
        ? [body.localPart]
        : []
  )
    .map((part) => part.trim())
    .filter(Boolean);

  if (!localParts.length) {
    return c.json(
      { error: "localPart or localParts is required" },
      400,
    );
  }

  const emails = [
    ...new Set(localParts.map((part) => `${part}@${domain}`.toLowerCase())),
  ];

  try {
    const cf = await createCloudflareClient(c.env);
    await ensureInboundWorkerRouting(
      cf,
      domain,
      emails,
      c.env.WORKER_SCRIPT_NAME,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to configure inbound routing";
    return c.json(
      {
        error: `Could not enable inbox for ${emails.join(", ")}: ${message}`,
      },
      502,
    );
  }

  const singleDisplayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const displayNames =
    body.displayNames && typeof body.displayNames === "object"
      ? body.displayNames
      : {};

  const entries = emails.map((email) => {
    const local = email.split("@")[0] ?? "";
    const fromMap =
      typeof displayNames[local] === "string"
        ? displayNames[local]!.trim()
        : "";
    return {
      email,
      displayName: fromMap || singleDisplayName || undefined,
    };
  });

  const { data, added } = await upsertAddresses(c.env.RELAYBASE_APP, domain, entries);
  if (added.length === 1) {
    return c.json({ address: added[0], addresses: added });
  }
  return c.json({
    addresses: added,
    all: data.addresses.filter((a) => a.domain === domain),
  });
});

adminAddresses.patch("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { email?: string; displayName?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }

  const data = await readMailbox(c.env.RELAYBASE_APP);
  const index = data.addresses.findIndex((a) => a.email === email);
  if (index < 0) {
    return c.json({ error: "Address not found" }, 404);
  }

  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim()
      : body.displayName === null
        ? ""
        : undefined;

  if (displayName !== undefined) {
    const current = data.addresses[index]!;
    data.addresses[index] = {
      email: current.email,
      domain: current.domain,
      ...(displayName ? { displayName } : {}),
    };
    await writeMailbox(c.env.RELAYBASE_APP, data);
  }

  return c.json({ address: data.addresses[index] });
});

adminAddresses.delete("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }

  const { data, removed } = await removeAddress(c.env.RELAYBASE_APP, email);
  if (removed) {
    try {
      const cf = await createCloudflareClient(c.env);
      await removeInboundWorkerRouting(cf, removed.domain, [removed.email]);
    } catch (error) {
      console.error("Failed to remove inbound routing", error);
    }
  }

  const domain = c.req.query("domain")?.trim().toLowerCase();
  return c.json({
    addresses: domain
      ? data.addresses.filter((a) => a.domain === domain)
      : data.addresses,
  });
});

export { adminAddresses };
