import imageCompression from "browser-image-compression";

/** Email-oriented defaults — fit screenshots under the 5 MiB send cap. */
const EMAIL_IMAGE_MAX_WIDTH_PX = 1600;
const EMAIL_IMAGE_QUALITY = 0.85;
const EMAIL_IMAGE_MAX_SIZE_MB = 1.5;
const DIMENSION_TOLERANCE_PX = 4;

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

/** Convert raster images to WebP (GIF unchanged; WebP passthrough when small enough). */
export async function optimizeImageToWebp(
  file: File,
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const mimeType = file.type || "application/octet-stream";
  if (mimeType === "image/gif") {
    return { blob: file, mimeType, filename: file.name };
  }
  if (!mimeType.startsWith("image/")) {
    return { blob: file, mimeType, filename: file.name };
  }

  const dims = await rasterImageDimensions(file);
  const maxWidth = EMAIL_IMAGE_MAX_WIDTH_PX;
  const longestSide =
    dims != null ? Math.max(dims.widthPx, dims.heightPx) : undefined;
  const shouldResize =
    longestSide !== undefined &&
    longestSide > maxWidth + DIMENSION_TOLERANCE_PX;
  const shouldConvertWebp = mimeType !== "image/webp";

  if (!shouldResize && !shouldConvertWebp) {
    return { blob: file, mimeType, filename: file.name };
  }

  const output = await imageCompression(file, {
    initialQuality: EMAIL_IMAGE_QUALITY,
    maxSizeMB: EMAIL_IMAGE_MAX_SIZE_MB,
    useWebWorker: true,
    fileType: "image/webp",
    ...(shouldResize ? { maxWidthOrHeight: maxWidth } : {}),
  });

  const outMime = output.type || "image/webp";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const filename =
    outMime === "image/webp" ? `${baseName}.webp` : file.name;
  return { blob: output, mimeType: outMime, filename };
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

export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}
