CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  email_verified_at TEXT
);

CREATE INDEX IF NOT EXISTS accounts_email_idx ON accounts (email);

CREATE TABLE IF NOT EXISTS account_workers (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  worker_url TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (account_id, worker_url)
);

CREATE INDEX IF NOT EXISTS account_workers_account_idx ON account_workers (account_id);

CREATE TABLE IF NOT EXISTS account_recovery (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,        -- 'password' | 'admin_token'
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS account_recovery_account_idx ON account_recovery (account_id);
