/// R2 bucket created during install.
pub(crate) const R2_BUCKET: &str = "relaybase-mailbox";

/// Default manifest URL (override via RELAYBASE_INSTALL_MANIFEST_URL).
pub(crate) const DEFAULT_MANIFEST_URL: &str =
    "https://relaybase.xyz/downloads/worker-install-manifest.json";

/// Typed confirmation required before wiping occupied R2 / D1.
pub const WIPE_PHRASE_DELETE_ME: &str = "DELETE ME";

/// D1 databases created during install. Each entry is (binding, db_name).
pub(crate) const D1_DATABASES: &[(&str, &str)] = &[
    ("RELAYBASE_LOGS", "relaybase-logs"),
    ("RELAYBASE_MAIL", "relaybase-mail"),
    ("RELAYBASE_DB", "relaybase-db"),
];

/// Backoff delays (seconds) between health-check retries after deploy (~30s total).
pub(crate) const WARMUP_BACKOFF_SECS: &[u64] = &[2, 4, 8, 16];
