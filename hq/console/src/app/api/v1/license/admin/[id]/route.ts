import { revokeLicense } from "@/lib/licenses";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";
import { isLicenseAdmin, json } from "@/lib/license-admin";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const env = await getEnv();
  if (!(await isLicenseAdmin(req, env))) return json({ error: "Unauthorized" }, 401);
  const { id } = await context.params;
  if (!id) return json({ error: "id required" }, 400);
  const ok = await revokeLicense(getDb(env), id);
  if (!ok) return json({ error: "Not found" }, 404);
  return json({ revoked: true });
}
