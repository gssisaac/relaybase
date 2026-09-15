/** Page-adjacent asset paths (ported from Railmark; Scale resolves to public URLs). */

export type PageAssetKind = "image" | "video" | "audio" | "document" | "file";

export const IMAGE_ASSET_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
export const VIDEO_ASSET_EXT_RE = /\.(mp4|webm|ogv|mov|mkv|m4v|avi|wmv|flv)$/i;
export const AUDIO_ASSET_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
export const DOCUMENT_ASSET_EXT_RE =
  /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub|pages|numbers|key|csv)$/i;
export const BLOCKED_ASSET_EXT_RE =
  /\.(md|ya?ml|html?|jsx?|mjs|cjs|tsx?|exe|bat|cmd|sh|ps1|dll|so|app)$/i;
export const SHORT_ASSET_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const SHORT_ASSET_ID_LENGTH = 8;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Matches hq/scale broadcast/automation asset folder stems (see render.ts broadcastAssetStem). */
export function campaignAssetStem(campaignId: string): string {
  return (
    campaignId
      .replace(/^campaign_/, "")
      .replace(/^broadcast_/, "")
      .replace(/^automation_/, "")
      .slice(0, 32) || "campaign"
  );
}

export function pageAssetFolderName(campaignId: string): string {
  return `.${campaignAssetStem(campaignId)}`;
}

export function slugifyFilename(name: string, fallback = "image"): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const stem = base.replace(/\.[^./]+$/, "");
  return slugify(stem) || fallback;
}

export function extensionFromFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function shortAssetId(
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes,
): string {
  const bytes = randomBytes(SHORT_ASSET_ID_LENGTH);
  let id = "";
  for (let i = 0; i < SHORT_ASSET_ID_LENGTH; i++) {
    id += SHORT_ASSET_ID_ALPHABET[(bytes[i] ?? 0) % SHORT_ASSET_ID_ALPHABET.length];
  }
  return id;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function pageAssetFilename(originalName: string, ext: string, id?: string): string {
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "webp";
  const fallback = IMAGE_ASSET_EXT_RE.test(`.${safeExt}`) ? "image" : "file";
  return `${id ?? shortAssetId()}-${slugifyFilename(originalName, fallback)}.${safeExt}`;
}

export function pageAssetMarkdownUrl(campaignId: string, filename: string): string {
  return `./${pageAssetFolderName(campaignId)}/${filename}`;
}

export function assetKindFromHref(href: string): PageAssetKind | null {
  const path = href.trim().split("#")[0].split("?")[0];
  if (!path) return null;
  if (IMAGE_ASSET_EXT_RE.test(path)) return "image";
  if (VIDEO_ASSET_EXT_RE.test(path)) return "video";
  if (AUDIO_ASSET_EXT_RE.test(path)) return "audio";
  if (DOCUMENT_ASSET_EXT_RE.test(path)) return "document";
  const ext = extensionFromFilename(path);
  if (!ext || BLOCKED_ASSET_EXT_RE.test(`.${ext}`)) return null;
  return "file";
}

export function classifyPageFile(file: { name: string; type?: string }): PageAssetKind {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return assetKindFromHref(file.name) ?? "file";
}

export function humanizeAssetFilename(filename: string, fallback = "file"): string {
  const stem = filename
    .replace(/\.[^./]+$/, "")
    .replace(/^[A-Z0-9]{8}-/, "");
  const words = stem.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return fallback;
  return words.join(" ");
}

/** Resolve `./.campaign/…` href against campaign id to a storage key segment. */
export function resolveCampaignAssetPath(campaignId: string, href: string): string | null {
  if (!href || /^(https?:|data:|blob:)/i.test(href)) return null;
  const relative = href.replace(/^\.\//, "");
  const folder = pageAssetFolderName(campaignId);
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;
  return `${campaignId}/${filename}`;
}

export function isUsableMediaSrc(url: string | undefined): boolean {
  if (!url) return false;
  if (/^(blob:|data:)/i.test(url)) return true;
  return /^(https?:|\/)/i.test(url);
}
