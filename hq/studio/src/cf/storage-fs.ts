import path from "node:path";

import nodeFs from "node:fs";

type R2BucketLike = {
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView): Promise<unknown>;
  delete(key: string): Promise<void>;
};

let mode: "node" | "r2" = "node";
let dataRoot = "";
const memory = new Map<string, Buffer>();
const dirty = new Set<string>();
let r2Bucket: R2BucketLike | null = null;

function normalizeKey(absPath: string): string {
  const rel = path.relative(dataRoot, absPath);
  if (rel.startsWith("..")) {
    return absPath.replace(/^\/+/, "");
  }
  return rel.split(path.sep).join("/");
}

function absFromKey(key: string): string {
  return path.join(dataRoot, key.split("/").join(path.sep));
}

export function storageDataRoot(): string {
  return dataRoot;
}

/** True when Studio runs on Cloudflare Workers with R2-backed virtual fs. */
export function isR2StorageMode(): boolean {
  return mode === "r2";
}

export function useNodeFilesystem(root: string): void {
  mode = "node";
  r2Bucket = null;
  dataRoot = root;
  memory.clear();
  dirty.clear();
}

export async function initR2Storage(bucket: R2BucketLike, root: string): Promise<void> {
  mode = "r2";
  r2Bucket = bucket;
  dataRoot = root;
  memory.clear();
  dirty.clear();

  let cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor });
    for (const obj of page.objects) {
      const objBody = await bucket.get(obj.key);
      if (!objBody) continue;
      const text = await objBody.text();
      memory.set(obj.key, Buffer.from(text, "utf8"));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export async function flushR2Storage(): Promise<void> {
  if (mode !== "r2" || !r2Bucket) return;
  for (const key of dirty) {
    const buf = memory.get(key);
    if (!buf) {
      await r2Bucket.delete(key);
      continue;
    }
    await r2Bucket.put(key, buf);
  }
  dirty.clear();
}

function readBuffer(absPath: string): Buffer {
  if (mode === "node") {
    return nodeFs.readFileSync(absPath);
  }
  const key = normalizeKey(absPath);
  const hit = memory.get(key);
  if (!hit) {
    const err = new Error(`ENOENT: no such file or directory, open '${absPath}'`) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  }
  return hit;
}

export interface StorageFs {
  existsSync(absPath: string): boolean;
  mkdirSync(absPath: string, options?: { recursive?: boolean }): void;
  readFileSync(absPath: string, encoding: BufferEncoding): string;
  readFileSync(absPath: string, encoding?: undefined): Buffer;
  readFileSync(absPath: string, encoding?: BufferEncoding): string | Buffer;
  writeFileSync(absPath: string, data: string | Buffer, encoding?: BufferEncoding): void;
  unlinkSync(absPath: string): void;
  copyFileSync(from: string, to: string): void;
  readdirSync(dir: string, options?: { withFileTypes?: false } | null): string[];
  readdirSync(
    dir: string,
    options: { withFileTypes: true }
  ): Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  readdirSync(
    dir: string,
    options?: { withFileTypes?: boolean } | null
  ): Array<string | { name: string; isDirectory(): boolean; isFile(): boolean }>;
  rmdirSync(dir: string): void;
}

const storageFs: StorageFs = {
  existsSync(absPath: string): boolean {
    if (mode === "node") return nodeFs.existsSync(absPath);
    return memory.has(normalizeKey(absPath));
  },

  mkdirSync(absPath: string, _options?: { recursive?: boolean }): void {
    if (mode === "node") {
      nodeFs.mkdirSync(absPath, { recursive: true });
      return;
    }
    /* virtual — directories implied by object keys */
  },

  readFileSync(absPath: string, encoding?: BufferEncoding): any {
    const buf = readBuffer(absPath);
    if (encoding) return buf.toString(encoding);
    return buf;
  },

  writeFileSync(absPath: string, data: string | Buffer, _encoding?: BufferEncoding): void {
    if (mode === "node") {
      nodeFs.writeFileSync(absPath, data);
      return;
    }
    const key = normalizeKey(absPath);
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    memory.set(key, buf);
    dirty.add(key);
  },

  unlinkSync(absPath: string): void {
    if (mode === "node") {
      nodeFs.unlinkSync(absPath);
      return;
    }
    const key = normalizeKey(absPath);
    memory.delete(key);
    dirty.add(key);
  },

  copyFileSync(from: string, to: string): void {
    if (mode === "node") {
      nodeFs.copyFileSync(from, to);
      return;
    }
    const buf = readBuffer(from);
    const key = normalizeKey(to);
    memory.set(key, Buffer.from(buf));
    dirty.add(key);
  },

  readdirSync(
    dir: string,
    options?: { withFileTypes?: boolean } | null
  ): any {
    if (mode === "node") {
      return (nodeFs.readdirSync as any)(dir, options);
    }
    const prefix = `${normalizeKey(dir).replace(/\/$/, "")}/`;
    const names = new Set<string>();
    for (const key of memory.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const seg = rest.split("/")[0];
      if (seg) names.add(seg);
    }
    if (options && "withFileTypes" in options && options.withFileTypes) {
      return [...names].map((name) => ({
        name,
        isDirectory: () => true,
        isFile: () => true,
      }));
    }
    return [...names];
  },

  rmdirSync(dir: string): void {
    if (mode === "node") {
      nodeFs.rmdirSync(dir);
      return;
    }
    const prefix = `${normalizeKey(dir).replace(/\/$/, "")}/`;
    for (const key of [...memory.keys()]) {
      if (key.startsWith(prefix)) {
        memory.delete(key);
        dirty.add(key);
      }
    }
  },
};

export default storageFs;
