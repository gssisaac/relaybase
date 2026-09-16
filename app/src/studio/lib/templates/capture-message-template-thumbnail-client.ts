import { toPng } from "html-to-image";

import { isPlainTextTemplate } from "@/studio/lib/layouts/layout-catalog";
import type { MessageTemplate, StudioLayout } from "@/lib/studio/api";

import { renderMessageTemplateThumbnailHtml } from "./render-message-template-thumbnail-html";

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 452;

const GMAIL_LINK_STYLES = `
  a[href] { color: #1155cc; text-decoration: underline; }
  a[href]:visited { color: #1155cc; }
`;

function escapePlainText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrapFragmentHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
  body { margin: 0; padding: 16px; background: #f6f8fc; }
  .message-template-thumb-body { max-width: 600px; margin: 0 auto; font-family: sans-serif; }
  .message-template-thumb-body p { margin: 0.75em 0; }
  .message-template-thumb-body p:first-child { margin-top: 0; }
  .message-template-thumb-body p:last-child { margin-bottom: 0; }
  ${GMAIL_LINK_STYLES}
</style></head><body><div class="message-template-thumb-body">${bodyHtml}</div></body></html>`;
}

function wrapPlainTextDocument(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
  body { margin: 0; padding: 16px; background: #f6f8fc; font-family: sans-serif; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 15px; line-height: 1.6; color: #202124; }
</style></head><body><pre>${escapePlainText(bodyHtml)}</pre></body></html>`;
}

function mountCaptureFrame(srcdoc: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = `${CAPTURE_WIDTH}px`;
  frame.style.height = `${CAPTURE_HEIGHT}px`;
  frame.style.border = "0";
  frame.style.pointerEvents = "none";
  frame.style.zIndex = "-1";
  frame.srcdoc = srcdoc;
  document.body.appendChild(frame);
  return frame;
}

async function waitForFrameLoad(frame: HTMLIFrameElement): Promise<HTMLElement> {
  await new Promise<void>((resolve, reject) => {
    frame.addEventListener("load", () => resolve(), { once: true });
    frame.addEventListener("error", () => reject(new Error("iframe load failed")), {
      once: true,
    });
  });
  const body = frame.contentDocument?.body;
  if (!body) throw new Error("iframe body missing");
  return body;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function wrapRenderedHtml(bodyHtml: string, layoutId: string): string {
  const plainText = isPlainTextTemplate(layoutId);
  if (plainText) {
    return wrapPlainTextDocument(bodyHtml);
  }
  if (/<\s*html[\s>]/i.test(bodyHtml)) {
    return bodyHtml;
  }
  return wrapFragmentHtml(bodyHtml);
}

export async function captureMessageTemplateThumbnailBlob(input: {
  template: Pick<MessageTemplate, "bodyMarkdown" | "layoutId" | "templateVariables" | "subject">;
  layout: StudioLayout | null;
}): Promise<Blob> {
  const layoutId = input.template.layoutId ?? input.layout?.id ?? "";
  const bodyHtml = renderMessageTemplateThumbnailHtml(input);
  const srcdoc = wrapRenderedHtml(bodyHtml, layoutId);

  const frame = mountCaptureFrame(srcdoc);
  try {
    const captureRoot = await waitForFrameLoad(frame);
    await waitForImages(captureRoot);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const dataUrl = await toPng(captureRoot, {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      pixelRatio: 2,
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    frame.remove();
  }
}
