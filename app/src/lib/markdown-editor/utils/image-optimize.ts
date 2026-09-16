import imageCompression from "browser-image-compression";

import {
  DEFAULT_IMAGE_OPTIMIZATION_SETTINGS,
  IMAGE_OPTIMIZE_DIMENSION_TOLERANCE_PX,
  maxWidthForSizeLevel,
  type ImageOptimizationSettings,
} from "./image-settings";

function fileIdentity(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Snapshot every dropped/pasted file before DataTransfer is invalidated. */
export function collectTransferFiles(data: DataTransfer | null): File[] {
  if (!data) return [];

  const seen = new Set<string>();
  const out: File[] = [];
  const add = (file: File | null | undefined) => {
    if (!file || file.size <= 0) return;
    const key = fileIdentity(file);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  if (data.files?.length) {
    for (let i = 0; i < data.files.length; i++) add(data.files[i]);
  }
  if (out.length === 0 && data.items?.length) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (item.kind !== "file") continue;
      add(item.getAsFile());
    }
  }
  return out;
}

export function transferHasFiles(data: DataTransfer | null): boolean {
  if (!data) return false;
  const types = Array.from(data.types ?? []);
  return types.includes("Files") || (data.files?.length ?? 0) > 0;
}

export function getClipboardFile(data: DataTransfer | null): File | null {
  return collectTransferFiles(data)[0] ?? null;
}

export function getClipboardImageFile(data: DataTransfer | null): File | null {
  const file = getClipboardFile(data);
  if (!file) return null;
  const type = file.type || "";
  if (type.startsWith("image/")) return file;
  if (!type) return file;
  return null;
}

export async function rasterImageDimensions(
  blob: Blob,
): Promise<{ widthPx: number; heightPx: number } | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const widthPx = bitmap.width;
    const heightPx = bitmap.height;
    bitmap.close();
    return { widthPx, heightPx };
  } catch {
    return undefined;
  }
}

/**
 * Sample the decoded bitmap for a non-opaque pixel. Email clients (Gmail,
 * Outlook) mangle transparency in JPEG/WebP, so any alpha use forces PNG
 * output (docs/features/studio-email-image-asset-cdn-spec.md §1.2/§6.3).
 */
async function hasTransparency(blob: Blob): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return false;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type EmailImageExt = "jpg" | "png" | "gif";

export type OptimizeForEmailResult = {
  file: File | Blob;
  mimeType: string;
  ext: EmailImageExt;
};

/**
 * Normalize any input image to the email-safe format policy: JPEG for
 * photos/banners, PNG when transparency is present, GIF passthrough for
 * animations. WebP/SVG/AVIF inputs are always converted — they are silently
 * mangled or stripped by Gmail and classic Outlook.
 * (docs/features/studio-email-image-asset-cdn-spec.md §1.2, §2, UC-4)
 */
export async function optimizeForEmail(
  file: File,
  settings: ImageOptimizationSettings = DEFAULT_IMAGE_OPTIMIZATION_SETTINGS,
): Promise<OptimizeForEmailResult> {
  const inputMime = file.type || "";
  if (inputMime === "image/gif") {
    return { file, mimeType: "image/gif", ext: "gif" };
  }

  const canHaveAlpha = inputMime === "image/png" || inputMime === "image/webp" || inputMime === "image/svg+xml";
  const preserveTransparency = canHaveAlpha && (await hasTransparency(file));
  const targetMime = preserveTransparency ? "image/png" : "image/jpeg";
  const targetExt: EmailImageExt = preserveTransparency ? "png" : "jpg";

  const dims = await rasterImageDimensions(file);
  const maxWidth = maxWidthForSizeLevel(settings.sizeLevel, settings.maxWidth);
  const longestSide = dims != null ? Math.max(dims.widthPx, dims.heightPx) : undefined;
  const shouldResize =
    maxWidth !== undefined &&
    longestSide !== undefined &&
    longestSide > maxWidth + IMAGE_OPTIMIZE_DIMENSION_TOLERANCE_PX;
  const shouldConvertFormat = inputMime !== targetMime;

  if (!shouldResize && !shouldConvertFormat) {
    return { file, mimeType: inputMime, ext: targetExt };
  }

  const compressionOptions: Parameters<typeof imageCompression>[1] = {
    initialQuality: settings.quality,
    maxSizeMB: 2,
    useWebWorker: true,
    fileType: targetMime,
  };
  if (shouldResize && maxWidth !== undefined) {
    compressionOptions.maxWidthOrHeight = maxWidth;
  }

  const output = await imageCompression(file, compressionOptions);
  return {
    file: output,
    mimeType: output.type || targetMime,
    ext: targetExt,
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });
}
