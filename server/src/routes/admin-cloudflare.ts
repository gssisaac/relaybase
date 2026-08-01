import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin, setAdminToken } from "../lib/auth";
import {
  cloudflareRuntimeConfigured,
  writeCloudflareRuntimeConfig,
} from "../lib/cloudflare-config";

const adminCloudflare = new Hono<{ Bindings: Env }>();

adminCloudflare.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const configured = await cloudflareRuntimeConfigured(c.env);
  return c.json({ configured });
});

adminCloudflare.put("/", async (c) => {
  const denied = await requireAdmin(c);
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
  if (!accountId || !apiToken) {
    return c.json({ error: "accountId and apiToken are required" }, 400);
  }

  await writeCloudflareRuntimeConfig(c.env.KEYS, { accountId, apiToken });

  const adminToken = body.adminToken?.trim();
  if (adminToken) {
    await setAdminToken(c.env.KEYS, adminToken);
  }

  return c.json({ configured: true, accountId });
});

export { adminCloudflare };
