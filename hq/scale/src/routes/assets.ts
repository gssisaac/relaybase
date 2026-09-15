import fs from "node:fs";
import path from "node:path";

import { Hono } from "hono";

import { store } from "../db/store";
import { DEFAULT_BRAND_LOGO_FILENAME } from "../lib/templates/brand-logo";
import { broadcastAssetKey } from "../lib/assets/key";
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

// POST /scale/broadcasts/:id/assets { filename, mimeType, contentBase64 }
scaleAssets.post("/broadcasts/:id/assets", async (c) => {
  const broadcastId = c.req.param("id");
  const broadcast = store.read().broadcasts.find((row) => row.id === broadcastId);
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

  const key = broadcastAssetKey(broadcastId, filename);
  const storedFilename = key.slice(broadcastId.length + 1);
  store.update((draft) => {
    draft.broadcastAssets = draft.broadcastAssets.filter((a) => a.key !== key);
    draft.broadcastAssets.push({
      id: newId("asset"),
      key,
      broadcastId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${SCALE_PUBLIC_BASE_URL}/scale/assets/${encodeURIComponent(broadcastId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// POST /scale/automations/:id/assets { filename, mimeType, contentBase64 }
scaleAssets.post("/automations/:id/assets", async (c) => {
  const automationId = c.req.param("id");
  const automation = store.read().automations.find((row) => row.id === automationId);
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

  const key = broadcastAssetKey(automationId, filename);
  const storedFilename = key.slice(automationId.length + 1);
  store.update((draft) => {
    draft.automationAssets = draft.automationAssets.filter((a) => a.key !== key);
    draft.automationAssets.push({
      id: newId("asset"),
      key,
      automationId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${SCALE_PUBLIC_BASE_URL}/scale/assets/automation/${encodeURIComponent(automationId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// GET /scale/assets/automation/:automationId/:filename
scaleAssets.get("/assets/automation/:automationId/:filename", (c) => {
  const key = `${c.req.param("automationId")}/${c.req.param("filename")}`;
  const asset = store.read().automationAssets.find((a) => a.key === key);
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

// GET /scale/assets/:broadcastId/:filename
scaleAssets.get("/assets/:broadcastId/:filename", (c) => {
  const broadcastId = c.req.param("broadcastId");
  if (broadcastId === "automation") return c.text("not found", 404);
  const key = `${broadcastId}/${c.req.param("filename")}`;
  const asset = store.read().broadcastAssets.find((a) => a.key === key);
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
