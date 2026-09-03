//! Per-Worker OS keyring account names.
//!
//! Each product Worker has its own D1 owner passtoken and sessions. The
//! same Mac can hold more than one install (different `workers.dev` URLs or
//! Cloudflare accounts). Account names are therefore scoped by normalized
//! Worker URL so a second login does not overwrite the first.
//!
//! Legacy unscoped items (`owner-passtoken`, `owner-session`) are migrated
//! on first read that matches their stored `workerUrl`.

use super::keyring_store;
use serde::{Deserialize, Serialize};

pub const KEYRING_SERVICE: &str = "com.relaybase.desktop";
pub const LEGACY_PASSTOKEN_USER: &str = "owner-passtoken";
pub const LEGACY_SESSION_USER: &str = "owner-session";
const INDEX_USER: &str = "owner-workers";

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerIndex {
    #[serde(default)]
    worker_urls: Vec<String>,
}

/// Trim and strip a trailing slash.
pub fn normalize_worker_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

pub fn worker_urls_equal(a: &str, b: &str) -> bool {
    normalize_worker_url(a).eq_ignore_ascii_case(&normalize_worker_url(b))
}

pub fn passtoken_account(worker_url: &str) -> String {
    format!("owner-passtoken:{}", normalize_worker_url(worker_url))
}

pub fn session_account(worker_url: &str) -> String {
    format!("owner-session:{}", normalize_worker_url(worker_url))
}

fn load_index() -> WorkerIndex {
    let raw = keyring_store::get_password(KEYRING_SERVICE, INDEX_USER)
        .ok()
        .flatten();
    let Some(raw) = raw else {
        return WorkerIndex::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_index(index: &WorkerIndex) -> Result<(), String> {
    let json = serde_json::to_string(index).map_err(|e| e.to_string())?;
    keyring_store::set_password(KEYRING_SERVICE, INDEX_USER, &json)
}

pub fn remember_worker_url(worker_url: &str) -> Result<(), String> {
    let url = normalize_worker_url(worker_url);
    if url.is_empty() {
        return Ok(());
    }
    let mut index = load_index();
    if index
        .worker_urls
        .iter()
        .any(|existing| worker_urls_equal(existing, &url))
    {
        return Ok(());
    }
    index.worker_urls.push(url);
    save_index(&index)
}

pub fn known_worker_urls() -> Vec<String> {
    let mut urls: Vec<String> = Vec::new();
    for url in load_index().worker_urls {
        let normalized = normalize_worker_url(&url);
        if normalized.is_empty() {
            continue;
        }
        if urls
            .iter()
            .any(|existing| worker_urls_equal(existing, &normalized))
        {
            continue;
        }
        urls.push(normalized);
    }
    urls
}
