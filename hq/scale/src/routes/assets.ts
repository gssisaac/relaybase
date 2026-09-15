import fs from "node:fs";
import path from "node:path";

import { Hono } from "hono";

import { store } from "../db/store";
import { DEFAULT_BRAND_LOGO_FILENAME } from "../lib/templates/brand-logo";
import { campaignAssetKey } from "../lib/assets/key";
import { SCALE_PUBLIC_BASE_URL } from "../lib/shared/scale-url";
import { newId } from "../lib/shared/ids";

export const scaleAssets = new Hono();

// GET /scale/brand/relaybase-icon.png — default template logo when none uploaded
scaleAssets.get("/brand/relaybase-icon.png", (c) => {
  const filePath = path.join(process.cwd(), "public", "brand", DEFAULT_BRAND_LOGO_FILENAME);
  if (!fs.existsSync(filePath)) return c.text("not found", 404);
  const buf = fs.readFileSync(filePath);
  return new Response(buf, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
});

// POST /scale/campaigns/:id/assets { filename, mimeType, contentBase64 }
scaleAssets.post("/campaigns/:id/assets", async (c) => {
  const campaignId = c.req.param("id");
  const broadcast = store.read().campaigns.find((row) => row.id === campaignId);
  if (!broadcast) return c.json({ error: "not found" }, 404);

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

  const key = campaignAssetKey(campaignId, filename);
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

  const url = `${SCALE_PUBLIC_BASE_URL}/scale/assets/${encodeURIComponent(campaignId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// POST /scale/triggers/:id/assets { filename, mimeType, contentBase64 }
scaleAssets.post("/triggers/:id/assets", async (c) => {
  const triggerId = c.req.param("id");
  const automation = store.read().triggers.find((row) => row.id === triggerId);
  if (!automation) return c.json({ error: "not found" }, 404);

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

  const key = campaignAssetKey(triggerId, filename);
  const storedFilename = key.slice(triggerId.length + 1);
  store.update((draft) => {
    draft.triggerAssets = draft.triggerAssets.filter((a) => a.key !== key);
    draft.triggerAssets.push({
      id: newId("asset"),
      key,
      triggerId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${SCALE_PUBLIC_BASE_URL}/scale/assets/trigger/${encodeURIComponent(triggerId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// GET /scale/assets/trigger/:triggerId/:filename (legacy /assets/automation/* still served)
scaleAssets.get("/assets/automation/:triggerId/:filename", (c) => {
  const key = `${c.req.param("triggerId")}/${c.req.param("filename")}`;
  const asset = store.read().triggerAssets.find((a) => a.key === key);
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

scaleAssets.get("/assets/trigger/:triggerId/:filename", (c) => {
  const key = `${c.req.param("triggerId")}/${c.req.param("filename")}`;
  const asset = store.read().triggerAssets.find((a) => a.key === key);
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

// GET /scale/assets/template/:templateId/:filename
scaleAssets.get("/assets/template/:templateId/:filename", (c) => {
  const key = `${c.req.param("templateId")}/${c.req.param("filename")}`;
  const asset = store.read().templateAssets.find((a) => a.key === key);
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

// GET /scale/assets/:campaignId/:filename
scaleAssets.get("/assets/:campaignId/:filename", (c) => {
  const campaignId = c.req.param("campaignId");
  if (campaignId === "automation" || campaignId === "trigger" || campaignId === "template") {
    return c.text("not found", 404);
  }
  const key = `${campaignId}/${c.req.param("filename")}`;
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
