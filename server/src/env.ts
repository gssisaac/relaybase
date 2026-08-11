export type Env = {
  RELAYBASE_APP: KVNamespace;
  INBOUND: R2Bucket;
  /** Hosted Relaybase account only — product ops/send logs. */
  RELAYBASE_LOGS?: D1Database;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  ADMIN_TOKEN?: string;
  WORKER_SCRIPT_NAME: string;
  INBOUND_BUCKET_NAME: string;
};
