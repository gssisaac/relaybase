import { invoke, isDesktopRuntime } from "./invoke";

/** Open an https URL in the system browser (required inside Tauri webview). */
export async function desktopOpenExternal(url: string): Promise<void> {
  if (!isDesktopRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external_url", { url });
}

/**
 * Open an attachment with the OS default application. The frontend base64-encodes
 * the attachment bytes (already fetched via the authenticated blob URL) and the
 * Rust side decodes, writes a temp file with the original extension, and hands it
 * to the OS opener (Preview / Acrobat / Photos). Desktop-only.
 */
export async function desktopOpenAttachment(
  filename: string,
  data: Uint8Array,
): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopOpenAttachment is only available in the desktop app");
  }
  const base64 = bytesToBase64(data);
  return invoke("open_local_file_with_default_app", {
    name: filename,
    base64Data: base64,
  });
}

/** Save a file to the user's Downloads folder (desktop only). Returns the saved path. */
export async function desktopSaveDownloadFile(
  filename: string,
  data: Uint8Array,
): Promise<string> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopSaveDownloadFile is only available in the desktop app");
  }
  const base64 = bytesToBase64(data);
  return invoke("save_download_file", {
    name: filename,
    base64Data: base64,
  });
}

/** Open a local file with the OS default application (desktop only). */
export async function desktopOpenFilePath(path: string): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopOpenFilePath is only available in the desktop app");
  }
  return invoke("open_file_path", { path });
}

/** Reveal a file in the system file manager (desktop only). */
export async function desktopRevealFileInFolder(path: string): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopRevealFileInFolder is only available in the desktop app");
  }
  return invoke("reveal_file_in_folder", { path });
}

/** Chunk-aware base64 encoder (avoids `String.fromCharCode(...largeArray)` stack limit). */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
