import { Hono } from "hono";

import { store } from "../db/store";
import { newId } from "../lib/ids";

export const crmAssets = new Hono();

const CRM_BASE_URL = process.env.CRM_PUBLIC_BASE_URL ?? "http://localhost:32831";

function assetKey(campaignId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
  return `${campaignId}/${safeName}`;
}

// POST /crm/campaigns/:id/assets { filename, mimeType, contentBase64 }
crmAssets.post("/campaigns/:id/assets", async (c) => {
  const campaignId = c.req.param("id");
  const campaign = store.read().campaigns.find((row) => row.id === campaignId);
  if (!campaign) return c.json({ error: "not found" }, 404);

  let body: { filename?: string; mimeType?: string; contentBase64?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const filename = String(body.filename ?? "").trim();
  const mimeType = String(body.mimeType ?? "application/octet-stream").trim();
  const contentBase64 = String(body.contentBase64 ?? "").trim();
  if (!filename || !contentBase64) {
    return c.json({ error: "filename and contentBase64 required" }, 400);
  }

  const key = assetKey(campaignId, filename);
  const storedFilename = key.slice(campaignId.length + 1);
  store.update((draft) => {
    draft.campaignAssets = draft.campaignAssets.filter((a) => a.key !== key);
    draft.campaignAssets.push({
      id: newId("asset"),
      key,
      campaignId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${CRM_BASE_URL}/crm/assets/${encodeURIComponent(campaignId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// GET /crm/assets/:campaignId/:filename
crmAssets.get("/assets/:campaignId/:filename", (c) => {
  const key = `${c.req.param("campaignId")}/${c.req.param("filename")}`;
  const asset = store.read().campaignAssets.find((a) => a.key === key);
  if (!asset) return c.text("not found", 404);
  const buf = Buffer.from(asset.contentBase64, "base64");
  return new Response(buf, {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
});
