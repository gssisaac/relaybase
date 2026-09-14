// Minimal in-memory ZIP reader — extracts named entries from a ZIP archive
// buffer using Node's built-in zlib (no filesystem, no child_process). This
// avoids shelling out to `unzip` (desktop's approach) since Route Handlers
// deployed on Cloudflare Workers (via OpenNext) have no writable disk.
import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

type CentralDirEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function findEndOfCentralDir(buf: Buffer): number {
  // Scan backwards for the EOCD signature (comment is usually empty/short).
  const maxScan = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - maxScan && i >= 0; i--) {
    if (buf.readUInt32LE(i) === END_OF_CENTRAL_DIR_SIG) return i;
  }
  throw new Error("Not a valid ZIP archive (no end-of-central-directory record)");
}

function readCentralDirectory(buf: Buffer): CentralDirEntry[] {
  const eocd = findEndOfCentralDir(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  const centralDirOffset = buf.readUInt32LE(eocd + 16);
  const entries: CentralDirEntry[] = [];
  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_DIR_SIG) {
      throw new Error("Corrupt ZIP central directory");
    }
    const compressionMethod = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function extractEntry(buf: Buffer, entry: CentralDirEntry): Buffer {
  const offset = entry.localHeaderOffset;
  if (buf.readUInt32LE(offset) !== LOCAL_FILE_HEADER_SIG) {
    throw new Error(`Corrupt ZIP local file header for ${entry.name}`);
  }
  const nameLen = buf.readUInt16LE(offset + 26);
  const extraLen = buf.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return Buffer.from(raw);
  if (entry.compressionMethod === 8) return inflateRawSync(raw);
  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}

export type ZipContents = Map<string, Buffer>;

/** Parse a ZIP buffer and return every entry's decompressed bytes by path. */
export function readZip(buf: Buffer): ZipContents {
  const entries = readCentralDirectory(buf);
  const out: ZipContents = new Map();
  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue; // directory entry
    out.set(entry.name, extractEntry(buf, entry));
  }
  return out;
}

/** Find a file within the zip regardless of a single leading top-level folder. */
export function findZipFile(zip: ZipContents, ...candidatePaths: string[]): Buffer | null {
  for (const candidate of candidatePaths) {
    if (zip.has(candidate)) return zip.get(candidate)!;
  }
  // Fall back to matching by basename under any top-level folder.
  for (const candidate of candidatePaths) {
    const base = candidate.split("/").pop();
    for (const [name, data] of zip) {
      if (name.endsWith(`/${base}`) || name === base) return data;
    }
  }
  return null;
}
