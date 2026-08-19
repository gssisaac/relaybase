interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  get(key: string, type: "stream"): Promise<ReadableStream | null>;
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

interface CloudflareEnv {
  KEMBO_OPS?: KVNamespace;
  RELAYBASE_APP_DOGFOOD?: KVNamespace;
}
