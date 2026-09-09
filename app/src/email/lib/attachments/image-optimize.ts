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

const HEIC_EXT_RE = /\.(heic|heif)$/i;

/**
 * HEIC/HEIF (default iPhone photo format) has essentially no viewer support
 * outside Apple's own ecosystem — Gmail, Outlook, and most non-Apple mail
 * clients can't preview or open it. Browsers are also inconsistent about
 * reporting its MIME type (Firefox reports `application/octet-stream`), so
 * detect it by extension too.
 */
function isHeicFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  return (
    type === "image/heic" || type === "image/heif" || HEIC_EXT_RE.test(file.name)
  );
}

/**
 * Resize/compress raster images that exceed the email-friendly budget,
 * keeping the original format (GIF always passes through unchanged).
 * HEIC/HEIF is always transcoded to JPEG regardless of size, since it's
 * unopenable for most recipients. WebP is deliberately avoided as an output
 * format for the same reason: it's poorly and inconsistently supported as a
 * mail attachment (e.g. Gmail's attachment viewer often reports "Unsupported
 * file type" for it).
 */
export async function optimizeImageForEmail(
  file: File,
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const heic = isHeicFile(file);
  const mimeType = heic ? "image/heic" : file.type || "application/octet-stream";
  if (!heic) {
    if (mimeType === "image/gif") {
      return { blob: file, mimeType, filename: file.name };
    }
    if (!mimeType.startsWith("image/")) {
      return { blob: file, mimeType, filename: file.name };
    }
  }

  const dims = await rasterImageDimensions(file);
  const maxWidth = EMAIL_IMAGE_MAX_WIDTH_PX;
  const longestSide =
    dims != null ? Math.max(dims.widthPx, dims.heightPx) : undefined;
  const shouldResize =
    longestSide !== undefined &&
    longestSide > maxWidth + DIMENSION_TOLERANCE_PX;
  const shouldCompress =
    heic ||
    shouldResize ||
    file.size > EMAIL_IMAGE_MAX_SIZE_MB * 1024 * 1024;

  if (!shouldCompress) {
    return { blob: file, mimeType, filename: file.name };
  }

  const targetType = heic ? "image/jpeg" : mimeType;
  const output = await imageCompression(file, {
    initialQuality: EMAIL_IMAGE_QUALITY,
    maxSizeMB: EMAIL_IMAGE_MAX_SIZE_MB,
    useWebWorker: true,
    fileType: targetType,
    ...(shouldResize ? { maxWidthOrHeight: maxWidth } : {}),
  });

  const outMime = output.type || targetType;
  const filename = heic
    ? `${file.name.replace(/\.[^.]+$/, "") || "image"}.jpg`
    : file.name;
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
