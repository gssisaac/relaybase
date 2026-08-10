import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { listOpsLogs } from "../../lib/ops-logs";

const consoleOpsLogs = new Hono<{ Bindings: Env }>();

consoleOpsLogs.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const limit = Number(c.req.query("limit") ?? "100");
  const status = c.req.query("status") ?? "all";
  const domain = c.req.query("domain")?.trim();

  if (!["all", "failed", "success"].includes(status)) {
    return c.json({ error: "status must be all, failed, or success" }, 400);
  }

  const result = await listOpsLogs(c.env.RELAYBASE_LOGS, {
    limit: Number.isFinite(limit) ? limit : 100,
    status: status as "all" | "failed" | "success",
    domain,
  });

  return c.json({ ...result, workerConnected: true });
});

export { consoleOpsLogs };
