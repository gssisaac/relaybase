/**
 * Renders message templates (layout + markdown body) to PNG under
 * public/studio/message-template-thumbnails/.
 *
 * Re-run when hq/studio template YAML or layout HTML changes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { parse as parseYaml } from "yaml";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const storePath = path.join(appRoot, "../hq/studio/data/store.json");
const templatesDir = path.join(appRoot, "../hq/studio/data/templates");
const brandLogoPath = path.join(appRoot, "../hq/studio/public/brand/relaybase-icon.png");
const outDir = path.join(appRoot, "public/studio/message-template-thumbnails");

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

  if (/<\s*html[\s>]/i.test(bodyHtml)) {
    return bodyHtml;
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

async function loadTemplates() {
  const files = await fs.readdir(templatesDir);
  const rows = [];
  for (const file of files) {
    if (!file.endsWith(".yaml")) continue;
    const raw = await fs.readFile(path.join(templatesDir, file), "utf8");
    const parsed = parseYaml(raw);
    if (parsed?.id && parsed?.bodyMarkdown != null) {
      rows.push(parsed);
    }
  }
  return rows;
}

async function main() {
  const defaultBrandLogoUrl = await loadDefaultBrandLogoDataUrl();

  const { renderMessageTemplateThumbnailHtml } = await import(
    "../src/studio/lib/templates/render-message-template-thumbnail-html.ts"
  );
  const { isPlainTextTemplate } = await import("../src/studio/lib/layouts/layout-catalog.ts");

  const storeRaw = await fs.readFile(storePath, "utf8");
  const store = JSON.parse(storeRaw);
  const layouts = store.layouts ?? [];
  const layoutById = new Map(layouts.map((row) => [row.id, row]));

  const templates = await loadTemplates();
  if (!templates.length) {
    console.error("No message templates found in hq/studio/data/templates");
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
    templates: [],
  };

  for (const template of templates) {
    const layoutId = template.layoutId ?? layouts[0]?.id;
    const layout = layoutById.get(layoutId) ?? null;
    const plainText = isPlainTextTemplate(layoutId ?? "");
    const bodyHtml = renderMessageTemplateThumbnailHtml({
      template: {
        bodyMarkdown: template.bodyMarkdown ?? "",
        layoutId: template.layoutId ?? null,
        templateVariables: template.templateVariables ?? {},
        subject: template.subject ?? "",
      },
      layout,
      defaultBrandLogoUrl,
    });
    const doc = wrapPreviewDocument(bodyHtml, plainText);
    await page.setContent(doc, { waitUntil: "networkidle" });

    const outFile = path.join(outDir, `${template.id}.png`);
    await page.screenshot({
      path: outFile,
      clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: CLIP_HEIGHT + 32 },
    });

    manifest.templates.push({ id: template.id, name: template.name, file: `${template.id}.png` });
    console.log(`Wrote ${path.relative(appRoot, outFile)}`);
  }

  await browser.close();

  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Done — ${manifest.templates.length} thumbnails in public/studio/message-template-thumbnails/`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
