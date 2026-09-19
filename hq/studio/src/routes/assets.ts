import fs from "../cf/storage-fs";
import path from "node:path";

import { Hono } from "hono";

import { store } from "../db/store";
import { DEFAULT_BRAND_LOGO_FILENAME } from "../lib/templates/brand-logo";
import { newsletterAssetKey } from "../lib/assets/key";
import { STUDIO_PUBLIC_BASE_URL } from "../lib/shared/studio-url";
import { newId } from "../lib/shared/ids";
import { FALLBACK_BRAND_LOGO_PNG } from "../lib/assets/fallback-brand-logo";

export const studioAssets = new Hono();

// GET /studio/brand/relaybase-icon.png — default template logo when none uploaded
studioAssets.get("/brand/relaybase-icon.png", (c) => {
  const filePath = path.join(process.cwd(), "public", "brand", DEFAULT_BRAND_LOGO_FILENAME);
  const buf = fs.existsSync(filePath) ? fs.readFileSync(filePath) : FALLBACK_BRAND_LOGO_PNG;
  return new Response(buf, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
});

// POST /studio/newsletters/:id/assets { filename, mimeType, contentBase64 }
studioAssets.post("/newsletters/:id/assets", async (c) => {
  const newsletterId = c.req.param("id");
  const broadcast = store.read().newsletters.find((row) => row.id === newsletterId);
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

  const key = newsletterAssetKey(newsletterId, filename);
  const storedFilename = key.slice(newsletterId.length + 1);
  store.update((draft) => {
    draft.newsletterAssets = draft.newsletterAssets.filter((a) => a.key !== key);
    draft.newsletterAssets.push({
      id: newId("asset"),
      key,
      newsletterId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${STUDIO_PUBLIC_BASE_URL}/studio/assets/${encodeURIComponent(newsletterId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// POST /studio/triggers/:id/assets { filename, mimeType, contentBase64 }
studioAssets.post("/triggers/:id/assets", async (c) => {
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

  const key = newsletterAssetKey(triggerId, filename);
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

  const url = `${STUDIO_PUBLIC_BASE_URL}/studio/assets/trigger/${encodeURIComponent(triggerId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

// GET /studio/assets/trigger/:triggerId/:filename (legacy /assets/automation/* still served)
studioAssets.get("/assets/automation/:triggerId/:filename", (c) => {
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

studioAssets.get("/assets/trigger/:triggerId/:filename", (c) => {
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

// GET /studio/assets/message/:messageId/:filename
studioAssets.get("/assets/message/:messageId/:filename", (c) => {
  const key = `${c.req.param("messageId")}/${c.req.param("filename")}`;
  const asset = store.read().messageAssets.find((a) => a.key === key);
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

// GET /studio/assets/:newsletterId/:filename
studioAssets.get("/assets/:newsletterId/:filename", (c) => {
  const newsletterId = c.req.param("newsletterId");
  if (newsletterId === "automation" || newsletterId === "trigger" || newsletterId === "message") {
    return c.text("not found", 404);
  }
  const key = `${newsletterId}/${c.req.param("filename")}`;
  const asset = store.read().newsletterAssets.find((a) => a.key === key);
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
