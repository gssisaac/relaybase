export type Env = {
  KEYS: KVNamespace;
  INBOUND: R2Bucket;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  ADMIN_TOKEN: string;
  WORKER_SCRIPT_NAME: string;
};
