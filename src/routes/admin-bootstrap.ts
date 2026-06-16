import { Hono } from "hono";
import type { Env } from "../env";
import { requireBootstrapAuth, setAdminToken } from "../lib/auth";
import { writeCloudflareRuntimeConfig } from "../lib/cloudflare-config";

const adminBootstrap = new Hono<{ Bindings: Env }>();

/** One-time or recovery setup using wrangler-deployed secrets. */
adminBootstrap.put("/", async (c) => {
  const denied = await requireBootstrapAuth(c);
  if (denied) return denied;

  let body: {
    accountId?: string;
    apiToken?: string;
    adminToken?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const accountId = body.accountId?.trim();
  const apiToken = body.apiToken?.trim();
  const adminToken = body.adminToken?.trim();
  if (!accountId || !apiToken || !adminToken) {
    return c.json(
      { error: "accountId, apiToken, and adminToken are required" },
      { status: 400 },
    );
  }

  await writeCloudflareRuntimeConfig(c.env.KEYS, { accountId, apiToken });
  await setAdminToken(c.env.KEYS, adminToken);

  return c.json({ configured: true, accountId });
});

export { adminBootstrap };
