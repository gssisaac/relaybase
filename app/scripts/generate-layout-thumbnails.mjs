/**
 * Renders built-in layout previews to PNG under public/studio/layout-thumbnails/.
 *
 * Re-run when hq/studio/public/templates/*/meta.yaml layout HTML changes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { parse as parseYaml } from "yaml";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const layoutsRoot = path.join(appRoot, "../hq/studio/public/templates");
const brandLogoPath = path.join(appRoot, "../hq/studio/public/brand/relaybase-icon.png");
const outDir = path.join(appRoot, "public/studio/layout-thumbnails");

const VIEWPORT_WIDTH = 640;
const CLIP_HEIGHT = 420;
const DEVICE_SCALE = 2;

const GMAIL_LINK_STYLES = `
  a[href] { color: #1155cc; text-decoration: underline; }
  a[href]:visited { color: #1155cc; }
`;

function escapePlainText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrapPreviewDocument(bodyHtml, plainText) {
  if (plainText) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { margin: 0; padding: 16px; background: #f6f8fc; font-family: sans-serif; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 15px; line-height: 1.6; color: #202124; }
</style></head>
<body><pre>${escapePlainText(bodyHtml)}</pre></body></html>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { margin: 0; padding: 16px; background: #f6f8fc; }
  .body { max-width: 600px; margin: 0 auto; }
  .body p { margin: 0.75em 0; }
  .body p:first-child { margin-top: 0; }
  .body p:last-child { margin-bottom: 0; }
  ${GMAIL_LINK_STYLES}
</style></head>
<body><div class="body">${bodyHtml}</div></body></html>`;
}

async function loadDefaultBrandLogoDataUrl() {
  const buf = await fs.readFile(brandLogoPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function loadLayouts() {
  const entries = await fs.readdir(layoutsRoot, { withFileTypes: true });
  const layouts = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const metaPath = path.join(layoutsRoot, ent.name, "meta.yaml");
    try {
      const raw = await fs.readFile(metaPath, "utf8");
      const parsed = parseYaml(raw);
      if (!parsed?.id) continue;
      layouts.push({
        id: parsed.id,
        name: parsed.name ?? parsed.id,
        htmlSource: parsed.html ?? parsed.htmlSource ?? "",
        variablesSchema: parsed.variables ?? parsed.variablesSchema ?? null,
        isBuiltin: true,
      });
    } catch {
      /* skip invalid layout dir */
    }
  }
  return layouts;
}

async function main() {
  const defaultBrandLogoUrl = await loadDefaultBrandLogoDataUrl();

  const { renderLayoutPreviewHtml } = await import(
    "../src/studio/lib/layouts/render-layout-preview-html.ts"
  );
  const { isPlainTextTemplate } = await import("../src/studio/lib/layouts/layout-catalog.ts");

  const allLayouts = await loadLayouts();
  const layouts = allLayouts.filter((row) => row.isBuiltin);

  if (!layouts.length) {
    console.error("No built-in layouts found under hq/studio/public/templates");
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Executable doesn't exist")) {
      console.error(
        "\nPlaywright Chromium is missing. Run:\n  pnpm exec playwright install chromium\n",
      );
    }
    throw err;
  }
  const page = await browser.newPage({
    viewport: { width: VIEWPORT_WIDTH, height: CLIP_HEIGHT + 32 },
    deviceScaleFactor: DEVICE_SCALE,
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    layouts: [],
  };

  for (const layout of layouts) {
    const plainText = isPlainTextTemplate(layout.id);
    const bodyHtml = renderLayoutPreviewHtml({
      layoutId: layout.id,
      htmlSource: layout.htmlSource,
      variablesSchema: layout.variablesSchema ?? null,
      defaultBrandLogoUrl,
    });
    const doc = wrapPreviewDocument(bodyHtml, plainText);
    await page.setContent(doc, { waitUntil: "networkidle" });

    const outFile = path.join(outDir, `${layout.id}.png`);
    await page.screenshot({
      path: outFile,
      clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: CLIP_HEIGHT + 32 },
    });

    manifest.layouts.push({ id: layout.id, name: layout.name, file: `${layout.id}.png` });
    console.log(`Wrote ${path.relative(appRoot, outFile)}`);
  }

  await browser.close();

  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Done — ${manifest.layouts.length} thumbnails in public/studio/layout-thumbnails/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
