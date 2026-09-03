//! Owner passtoken in a **separate** keyring item from `owner-session`.
//!
//! Items are scoped by Worker URL (`owner-passtoken:{url}`) so two installs
//! do not overwrite each other. Write has no biometry (the user just created
//! or typed the secret). Read happens only inside `owner_login_from_keyring`
//! after Touch ID. JS never sees a keyring read.

use serde::{Deserialize, Serialize};

use super::keyring_store;
use super::worker_accounts::{
    self, known_worker_urls, passtoken_account, remember_worker_url, worker_urls_equal,
    KEYRING_SERVICE, LEGACY_PASSTOKEN_USER,
};

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

fn valid_record(record: PasstokenRecord) -> Option<PasstokenRecord> {
    if is_valid_passtoken_format(&record.passtoken) {
        Some(record)
    } else {
        None
    }
}

fn read_account(account: &str, uncached: bool) -> Option<PasstokenRecord> {
    let raw = if uncached {
        keyring_store::get_password_uncached(KEYRING_SERVICE, account)
            .ok()
            .flatten()?
    } else {
        keyring_store::get_password(KEYRING_SERVICE, account)
            .ok()
            .flatten()?
    };
    valid_record(parse_record(&raw)?)
}

fn legacy_matches(record: &PasstokenRecord, worker_url: &str) -> bool {
    record.worker_url.trim().is_empty()
        || worker_urls_equal(&record.worker_url, worker_url)
}

fn read_legacy(uncached: bool) -> Option<PasstokenRecord> {
    read_account(LEGACY_PASSTOKEN_USER, uncached)
}

fn migrate_legacy_if_matches(worker_url: &str, record: &PasstokenRecord) {
    if !legacy_matches(record, worker_url) {
        return;
    }
    let _ = store(&record.passtoken, worker_url);
    keyring_store::delete_password(KEYRING_SERVICE, LEGACY_PASSTOKEN_USER);
}

fn read_for_worker(worker_url: &str, uncached: bool) -> Option<PasstokenRecord> {
    let url = worker_accounts::normalize_worker_url(worker_url);
    if url.is_empty() {
        return None;
    }
    if let Some(record) = read_account(&passtoken_account(&url), uncached) {
        let _ = remember_worker_url(&url);
        return Some(record);
    }
    let legacy = read_legacy(uncached)?;
    if !legacy_matches(&legacy, &url) {
        return None;
    }
    migrate_legacy_if_matches(&url, &legacy);
    Some(legacy)
}

/// Valid stored passtoken for this Worker (format-checked; secret is not returned to JS).
pub fn is_stored(worker_url: Option<&str>) -> bool {
    let Some(url) = worker_url.map(worker_accounts::normalize_worker_url).filter(|u| !u.is_empty()) else {
        return false;
    };
    read_for_worker(&url, false).is_some()
}

/// Prefix hint for Worker matching — never returns the secret.
pub fn stored_prefix(worker_url: Option<&str>) -> String {
    let Some(url) = worker_url.map(worker_accounts::normalize_worker_url).filter(|u| !u.is_empty()) else {
        return String::new();
    };
    read_for_worker(&url, false)
        .map(|r| r.passtoken_prefix)
        .unwrap_or_default()
}

pub fn store(passtoken: &str, worker_url: &str) -> Result<(), String> {
    let passtoken = passtoken.trim();
    if passtoken.is_empty() {
        return Err("Passtoken is required".into());
    }
    let url = worker_accounts::normalize_worker_url(worker_url);
    if url.is_empty() {
        return Err("Worker URL is required".into());
    }
    let record = PasstokenRecord {
        passtoken: passtoken.to_string(),
        worker_url: url.clone(),
        passtoken_prefix: passtoken_prefix(passtoken),
    };
    let json = serde_json::to_string(&record).map_err(|e| e.to_string())?;
    remember_worker_url(&url)?;
    let account = passtoken_account(&url);
    keyring_store::set_password(KEYRING_SERVICE, &account, &json)?;
    keyring_store::forget_cached_password(KEYRING_SERVICE, &account);
    if let Some(legacy) = read_legacy(false) {
        if legacy_matches(&legacy, &url) {
            keyring_store::delete_password(KEYRING_SERVICE, LEGACY_PASSTOKEN_USER);
        }
    }
    Ok(())
}

/// Read the stored passtoken for this Worker. Caller must have already passed
/// biometry (or be on a platform with no biometry).
pub fn load_after_auth(worker_url: Option<&str>) -> Result<Option<PasstokenRecord>, String> {
    let Some(url) = worker_url
        .map(worker_accounts::normalize_worker_url)
        .filter(|u| !u.is_empty())
    else {
        return Ok(None);
    };
    Ok(read_for_worker(&url, true))
}

/// Delete the passtoken for one Worker. Other Worker items are left alone.
pub fn delete(worker_url: &str) {
    let url = worker_accounts::normalize_worker_url(worker_url);
    if url.is_empty() {
        return;
    }
    keyring_store::delete_password(KEYRING_SERVICE, &passtoken_account(&url));
    if let Some(legacy) = read_legacy(false) {
        if legacy_matches(&legacy, &url) {
            keyring_store::delete_password(KEYRING_SERVICE, LEGACY_PASSTOKEN_USER);
        }
    }
}

pub fn listed_worker_urls() -> Vec<String> {
    known_worker_urls()
}
