export type Env = {
  RELAYBASE_APP: KVNamespace;
  INBOUND: R2Bucket;
  /** Hosted Relaybase account only — omitted from customer install ZIP. */
  RELAYBASE_WAITLIST?: D1Database;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  ADMIN_TOKEN?: string;
  WORKER_SCRIPT_NAME: string;
  INBOUND_BUCKET_NAME: string;
  /** Optional — license Stripe webhook (hosted on Relaybase account only). */
  STRIPE_WEBHOOK_SECRET?: string;
};
