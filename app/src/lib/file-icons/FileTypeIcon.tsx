"use client";

import type { LucideIcon } from "lucide-react";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  resolveFileIconKind,
  type FileIconKind,
} from "@/lib/file-icons/resolve-file-icon";

const ICONS: Record<FileIconKind, LucideIcon> = {
  pdf: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  code: FileCode,
  generic: File,
};

const KIND_CLASS: Record<FileIconKind, string> = {
  pdf: "text-red-500",
  image: "text-sky-500",
  video: "text-violet-500",
  audio: "text-amber-500",
  archive: "text-orange-500",
  spreadsheet: "text-emerald-500",
  document: "text-blue-500",
  code: "text-muted-foreground",
  generic: "text-muted-foreground",
};

export function FileTypeIcon({
  filename,
  contentType,
  className,
}: {
  filename: string;
  contentType?: string | null;
  className?: string;
}) {
  const kind = resolveFileIconKind(filename, contentType);
  const Icon = ICONS[kind];
  return (
    <Icon
      className={cn("size-4 shrink-0", KIND_CLASS[kind], className)}
      aria-hidden
    />
  );
}
