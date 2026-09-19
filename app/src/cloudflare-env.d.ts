interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown | null>;
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob,
    options?: {
      httpMetadata?: { contentType?: string; contentDisposition?: string };
    },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(keys: string | string[]): Promise<void>;
}

interface CloudflareEnv {
  hq_relaybase_feedback?: KVNamespace;
  hq_relaybase_feedback_r2?: R2Bucket;
  HQ_INTERNAL_AUTH_SECRET?: string;
  HQ_JWT_SECRET?: string;
  STUDIO_UPSTREAM_URL?: string;
}
