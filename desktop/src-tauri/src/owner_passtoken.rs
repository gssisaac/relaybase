//! Owner passtoken in a **separate** keyring item from `owner-session`.
//!
//! Write has no biometry (the user just created or typed the secret).
//! Read happens only inside `owner_login_from_keyring` after Touch ID.
//! JS never sees a keyring read.

use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "com.relaybase.desktop";
const KEYRING_USER: &str = "owner-passtoken";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasstokenRecord {
    pub passtoken: String,
    #[serde(default)]
    pub worker_url: String,
}

fn parse_record(raw: &str) -> Option<PasstokenRecord> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(record) = serde_json::from_str::<PasstokenRecord>(trimmed) {
        if !record.passtoken.trim().is_empty() {
            return Some(record);
        }
    }
    // Legacy / raw token write.
    if trimmed.starts_with("rb_pass_") {
        return Some(PasstokenRecord {
            passtoken: trimmed.to_string(),
            worker_url: String::new(),
        });
    }
    None
}

/// Existence only — does not load the secret into the session cache.
pub fn exists() -> bool {
    crate::keyring_store::has_password(KEYRING_SERVICE, KEYRING_USER).unwrap_or(false)
}

pub fn store(passtoken: &str, worker_url: &str) -> Result<(), String> {
    let passtoken = passtoken.trim();
    if passtoken.is_empty() {
        return Err("Passtoken is required".into());
    }
    let record = PasstokenRecord {
        passtoken: passtoken.to_string(),
        worker_url: worker_url.trim().trim_end_matches('/').to_string(),
    };
    let json = serde_json::to_string(&record).map_err(|e| e.to_string())?;
    crate::keyring_store::set_password(KEYRING_SERVICE, KEYRING_USER, &json)?;
    crate::keyring_store::forget_cached_password(KEYRING_SERVICE, KEYRING_USER);
    Ok(())
}

/// Read the stored passtoken. Caller must have already passed biometry
/// (or be on a platform with no biometry).
pub fn load_after_auth() -> Result<Option<PasstokenRecord>, String> {
    let raw = crate::keyring_store::get_password_uncached(KEYRING_SERVICE, KEYRING_USER)?;
    Ok(raw.as_deref().and_then(parse_record))
}

pub fn delete() {
    crate::keyring_store::delete_password(KEYRING_SERVICE, KEYRING_USER);
}
