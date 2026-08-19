export type Env = {
  RELAYBASE_APP: KVNamespace;
  /** Mailbox R2 (`relaybase-mailbox`): inbound/{domain}/… and sent/{domain}/… */
  INBOUND: R2Bucket;
  /** Hosted Relaybase account only — product ops/send logs. */
  RELAYBASE_LOGS?: D1Database;
  /** FTS5 search index over inbound mail (R2 stays source of truth). */
  RELAYBASE_INBOX_INDEX?: D1Database;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  ADMIN_TOKEN?: string;
  WORKER_SCRIPT_NAME: string;
  INBOUND_BUCKET_NAME: string;
};
