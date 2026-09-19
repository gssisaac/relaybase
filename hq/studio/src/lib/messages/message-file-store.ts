import fs from "node:fs";
import path from "node:path";

import { Document, isScalar, parse as parseYaml, Scalar } from "yaml";

import type { Message } from "../../db/types";
import { isPostgresStoreEnabled } from "../../db/orm/data-source";
import { getPostgresStoreCache } from "../../db/postgres-store-runtime";
import { ensureYamlStorageSplit } from "./ensure-yaml-storage-split";
import { isCatalogBlueprintMessageId, isLibraryMessageId } from "./message-library";

function resolveMessagesDir(): string {
  const dataDir = process.env.STUDIO_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dataDir, "messages");
}

function normalizeMessage(row: Message): Message {
  if (row.layoutId === "tpl-header-image") {
    row.layoutId = "tpl-header";
  }
  if (row.templateVariables === undefined) row.templateVariables = {};
  if (row.previewText === undefined) row.previewText = null;
  if (row.forkedFromTemplateId === undefined) row.forkedFromTemplateId = null;
  return row;
}

function isMessageRecord(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const row = value as Message;
  return typeof row.id === "string" && typeof row.name === "string";
}

function messageFilePath(dir: string, id: string): string {
  return path.join(dir, `${id}.yaml`);
}

function readMessageFile(filePath: string): Message | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = parseYaml(fs.readFileSync(filePath, "utf8"));
    if (!isMessageRecord(parsed)) return null;
    return normalizeMessage(parsed);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") return null;
    console.error(`[message-store] Failed to parse ${filePath}:`, err);
    return null;
  }
}

function stringifyMessage(message: Message): string {
  const doc = new Document(message);
  const bodyNode = doc.getIn(["bodyMarkdown"], true);
  if (
    bodyNode &&
    isScalar(bodyNode) &&
    typeof bodyNode.value === "string" &&
    bodyNode.value.includes("\n")
  ) {
    bodyNode.type = Scalar.BLOCK_LITERAL;
  }
  return String(doc);
}

function writeMessageFile(dir: string, message: Message) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    messageFilePath(dir, message.id),
    `${stringifyMessage(message)}\n`,
    "utf8",
  );
}

/** User-editable messages persisted as one YAML file per message. */
export const messageFileStore = {
  dataDir: resolveMessagesDir(),

  /** Standalone saved copies (not trigger/newsletter-owned, not catalog presets). */
  listLibrary(): Message[] {
    return this.listAll().filter((m) => isLibraryMessageId(m.id));
  },

  /** All editable messages for `/studio/messages` (includes trigger/newsletter bodies). */
  listForGallery(): Message[] {
    return this.listAll().filter((m) => !isCatalogBlueprintMessageId(m.id));
  },

  listAll(): Message[] {
    if (isPostgresStoreEnabled()) {
      return getPostgresStoreCache()?.messages ?? [];
    }
    ensureYamlStorageSplit();
    const dir = resolveMessagesDir();
    fs.mkdirSync(dir, { recursive: true });

    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));

    const messages: Message[] = [];
    for (const file of files) {
      const row = readMessageFile(path.join(dir, file));
      if (row) messages.push(row);
    }

    messages.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return messages;
  },

  findById(id: string): Message | undefined {
    if (isPostgresStoreEnabled()) {
      return getPostgresStoreCache()?.messages.find((m) => m.id === id);
    }
    ensureYamlStorageSplit();
    const direct = readMessageFile(messageFilePath(resolveMessagesDir(), id));
    if (direct) return direct;
    return this.listAll().find((m) => m.id === id);
  },

  save(message: Message): void {
    if (isPostgresStoreEnabled()) {
      return;
    }
    writeMessageFile(resolveMessagesDir(), normalizeMessage({ ...message }));
  },

  delete(id: string): boolean {
    if (isPostgresStoreEnabled()) {
      return false;
    }
    const filePath = messageFilePath(resolveMessagesDir(), id);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  },

  layoutIsReferenced(layoutId: string): boolean {
    return this.listAll().some((m) => m.layoutId === layoutId);
  },

  /** One-time import from legacy store.json `templates[]` rows (non-preset). */
  importFromLegacyRows(rows: Message[]): number {
    if (rows.length === 0) return 0;
    ensureYamlStorageSplit();
    const dir = resolveMessagesDir();
    fs.mkdirSync(dir, { recursive: true });
    let written = 0;
    for (const row of rows) {
      writeMessageFile(dir, normalizeMessage(row));
      written += 1;
    }
    return written;
  },
};
