import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { createCloudflareClient } from "../../lib/cloudflare-config";
import {
  applyDomainBrandingDns,
  fetchDomainBrandingStatus,
  mergeDomainBranding,
  type DmarcPolicy,
} from "../../lib/branding";

const consoleBranding = new Hono<{ Bindings: Env }>();

consoleBranding.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }

  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cloudflare is not configured on this worker.",
      },
      503,
    );
  }

  const status = await fetchDomainBrandingStatus(c.env.RELAYBASE_APP, cf, domain);
  return c.json(status);
});

consoleBranding.put("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const body = (await c.req.json()) as {
    domain?: string;
    dmarcPolicy?: DmarcPolicy;
    dmarcRua?: string;
  };
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }

  await mergeDomainBranding(c.env.RELAYBASE_APP, domain, {
    dmarcPolicy: body.dmarcPolicy,
    dmarcRua: body.dmarcRua,
  });

  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cloudflare is not configured on this worker.",
      },
      503,
    );
  }

  const status = await fetchDomainBrandingStatus(c.env.RELAYBASE_APP, cf, domain);
  return c.json(status);
});

consoleBranding.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const body = (await c.req.json()) as { domain?: string };
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }

  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cloudflare is not configured on this worker.",
      },
      503,
    );
  }

  const status = await applyDomainBrandingDns(c.env.RELAYBASE_APP, cf, domain);
  return c.json(status);
});

export { consoleBranding };
