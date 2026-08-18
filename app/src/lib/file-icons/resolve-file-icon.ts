export type FileIconKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "spreadsheet"
  | "document"
  | "code"
  | "generic";

function extensionOf(filename: string): string {
  const base = filename.trim().split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

const EXT_KIND: Record<string, FileIconKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  heic: "image",
  heif: "image",
  bmp: "image",
  tiff: "image",
  tif: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  flac: "audio",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  gz: "archive",
  tar: "archive",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  csv: "spreadsheet",
  ods: "spreadsheet",
  doc: "document",
  docx: "document",
  rtf: "document",
  txt: "document",
  md: "document",
  pages: "document",
  ppt: "document",
  pptx: "document",
  js: "code",
  ts: "code",
  jsx: "code",
  tsx: "code",
  json: "code",
  xml: "code",
  html: "code",
  css: "code",
  py: "code",
  rs: "code",
  go: "code",
};

const MIME_KIND: Record<string, FileIconKind> = {
  "application/pdf": "pdf",
  "image/": "image",
  "video/": "video",
  "audio/": "audio",
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/x-rar-compressed": "archive",
  "application/x-7z-compressed": "archive",
  "application/gzip": "archive",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "spreadsheet",
  "text/csv": "spreadsheet",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "text/plain": "document",
  "text/markdown": "document",
  "application/json": "code",
  "text/html": "code",
  "text/javascript": "code",
  "application/javascript": "code",
};

/** Resolve a coarse file icon kind from filename and optional MIME type. */
export function resolveFileIconKind(
  filename: string,
  contentType?: string | null,
): FileIconKind {
  const ext = extensionOf(filename);
  if (ext && EXT_KIND[ext]) return EXT_KIND[ext];

  const mime = contentType?.trim().toLowerCase() ?? "";
  if (mime) {
    for (const [prefix, kind] of Object.entries(MIME_KIND)) {
      if (prefix.endsWith("/")) {
        if (mime.startsWith(prefix)) return kind;
      } else if (mime === prefix) {
        return kind;
      }
    }
  }

  return "generic";
}
