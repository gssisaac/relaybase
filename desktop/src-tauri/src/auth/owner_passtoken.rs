//! Owner passtoken in a **separate** keyring item from `owner-session`.
//!
//! Write has no biometry (the user just created or typed the secret).
//! Read happens only inside `owner_login_from_keyring` after Touch ID.
//! JS never sees a keyring read.

use serde::{Deserialize, Serialize};
use super::keyring_store;

const KEYRING_SERVICE: &str = "com.relaybase.desktop";
const KEYRING_USER: &str = "owner-passtoken";
const PASSTOKEN_PREFIX: &str = "rb_pass_";
const PREFIX_LEN: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasstokenRecord {
    pub passtoken: String,
    #[serde(default)]
    pub worker_url: String,
    #[serde(default)]
    pub passtoken_prefix: String,
}

fn passtoken_prefix(token: &str) -> String {
    let stripped = token
        .trim()
        .strip_prefix(PASSTOKEN_PREFIX)
        .unwrap_or(token.trim());
    stripped.chars().take(PREFIX_LEN).collect()
}

fn is_valid_passtoken_format(token: &str) -> bool {
    let trimmed = token.trim();
    trimmed.starts_with(PASSTOKEN_PREFIX) && trimmed.len() > PASSTOKEN_PREFIX.len() + PREFIX_LEN
}

fn parse_record(raw: &str) -> Option<PasstokenRecord> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(mut record) = serde_json::from_str::<PasstokenRecord>(trimmed) {
        if record.passtoken.trim().is_empty() {
            return None;
        }
        if record.passtoken_prefix.trim().is_empty() {
            record.passtoken_prefix = passtoken_prefix(&record.passtoken);
        }
        return Some(record);
    }
    // Legacy / raw token write.
    if trimmed.starts_with(PASSTOKEN_PREFIX) {
        return Some(PasstokenRecord {
            passtoken: trimmed.to_string(),
            worker_url: String::new(),
            passtoken_prefix: passtoken_prefix(trimmed),
        });
    }
    None
}

fn read_record() -> Option<PasstokenRecord> {
    let raw = keyring_store::get_password(KEYRING_SERVICE, KEYRING_USER)
        .ok()
        .flatten()?;
    let record = parse_record(&raw)?;
    if is_valid_passtoken_format(&record.passtoken) {
        Some(record)
    } else {
        None
    }
}

/// Valid stored passtoken (format-checked; secret is not returned to JS).
pub fn is_stored() -> bool {
    read_record().is_some()
}

/// Prefix hint for Worker matching — never returns the secret.
pub fn stored_prefix() -> String {
    read_record()
        .map(|r| r.passtoken_prefix)
        .unwrap_or_default()
}

pub fn store(passtoken: &str, worker_url: &str) -> Result<(), String> {
    let passtoken = passtoken.trim();
    if passtoken.is_empty() {
        return Err("Passtoken is required".into());
    }
    let record = PasstokenRecord {
        passtoken: passtoken.to_string(),
        worker_url: worker_url.trim().trim_end_matches('/').to_string(),
        passtoken_prefix: passtoken_prefix(passtoken),
    };
    let json = serde_json::to_string(&record).map_err(|e| e.to_string())?;
    keyring_store::set_password(KEYRING_SERVICE, KEYRING_USER, &json)?;
    keyring_store::forget_cached_password(KEYRING_SERVICE, KEYRING_USER);
    Ok(())
}

/// Read the stored passtoken. Caller must have already passed biometry
/// (or be on a platform with no biometry).
pub fn load_after_auth() -> Result<Option<PasstokenRecord>, String> {
    let raw = keyring_store::get_password_uncached(KEYRING_SERVICE, KEYRING_USER)?;
    Ok(raw.as_deref().and_then(parse_record))
}

pub fn delete() {
    keyring_store::delete_password(KEYRING_SERVICE, KEYRING_USER);
}
