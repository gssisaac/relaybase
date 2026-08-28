use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerInstallManifest {
    pub version: String,
    pub zip_url: String,
    pub zip_sha256: String,
    pub published_at: String,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerUpdateCheck {
    pub update_available: bool,
    pub latest_version: String,
    pub current_version: Option<String>,
    pub zip_url: Option<String>,
    pub zip_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoInstallResult {
    pub worker_url: String,
    pub worker_script_name: String,
    /// AUTH_PEPPER just set on the Worker. Held in JS memory only during
    /// setup-admin; never written to ~/.relaybase.
    pub auth_pepper: String,
    /// Always empty — kept so older JS still deserializes.
    #[serde(default)]
    pub admin_token: String,
    pub r2_bucket: String,
    pub account_id: String,
    pub d1_logs_id: String,
    pub d1_mail_id: String,
    pub d1_db_id: String,
    pub db_already_initialized: bool,
    pub db_applied: Vec<String>,
    pub worker_version: String,
}

/// Compare the saved Worker URL with the workers.dev URL of the OAuth account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerUpdateTarget {
    pub expected_worker_url: String,
    pub oauth_account_id: String,
    pub oauth_worker_url: String,
    pub connected_account_id: String,
    pub matches: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResourceProbe {
    pub kind: String,
    pub name: String,
    pub present: bool,
    pub id: String,
    #[serde(default)]
    pub object_count: Option<u64>,
    #[serde(default)]
    pub row_count: Option<u64>,
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub occupied: bool,
}

impl InstallResourceProbe {
    pub(crate) fn base(
        kind: &str,
        name: impl Into<String>,
        present: bool,
        id: impl Into<String>,
    ) -> Self {
        Self {
            kind: kind.into(),
            name: name.into(),
            present,
            id: id.into(),
            object_count: None,
            row_count: None,
            truncated: false,
            occupied: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProbeResult {
    pub account_id: String,
    pub resources: Vec<InstallResourceProbe>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallDecision {
    pub kind: String,
    pub name: String,
    pub action: String,
}

/// Result from the Worker's POST /console/init-db or /console/migrate-db.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitDbResult {
    pub ok: bool,
    #[serde(default)]
    pub already_initialized: bool,
    pub applied: Vec<String>,
    #[serde(default)]
    pub skipped: Vec<String>,
    #[serde(default)]
    pub cleared: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LogEvent {
    pub(crate) step: String,
    pub(crate) level: String,
    pub(crate) line: String,
}

#[derive(Default)]
pub(crate) struct InstallRunOptions {
    /// When set, reuse this AUTH_PEPPER instead of generating a new one (Worker update).
    pub(crate) existing_auth_pepper: Option<String>,
    /// When true, skip AUTH_PEPPER secret put (update keeps existing secret).
    pub(crate) skip_auth_pepper: bool,
    /// Worker script only — look up existing R2/D1, never create or wipe.
    pub(crate) worker_only: bool,
}
