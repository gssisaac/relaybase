use std::sync::Mutex;
use super::credentials::StoredCredentials;
use crate::cloudflare::oauth::load_keyring_oauth_refresh;

/// CF OAuth session — process memory only, never written to disk.
#[derive(Debug, Clone)]
pub struct CfOAuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub access_expires_at: String,
    pub account_id: String,
    /// Client id used for this session (install vs passtoken-updater).
    /// Refresh must use the same client; empty = fetch install config.
    pub client_id: String,
}

static CF_OAUTH_SESSION: Mutex<Option<CfOAuthSession>> = Mutex::new(None);

pub fn set_cf_oauth_session(session: CfOAuthSession) {
    if let Ok(mut guard) = CF_OAUTH_SESSION.lock() {
        *guard = Some(session.clone());
    }
    #[cfg(debug_assertions)]
    crate::dev::save_cf_oauth_cache(&session);
}

pub fn get_cf_oauth_session() -> Option<CfOAuthSession> {
    let cached = CF_OAUTH_SESSION
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    if cached.is_some() {
        return cached;
    }
    #[cfg(debug_assertions)]
    {
        let loaded = crate::dev::load_cf_oauth_cache()?;
        set_cf_oauth_session(loaded.clone());
        return Some(loaded);
    }
    #[cfg(not(debug_assertions))]
    None
}

pub fn clear_cf_oauth_session() {
    if let Ok(mut guard) = CF_OAUTH_SESSION.lock() {
        *guard = None;
    }
    #[cfg(debug_assertions)]
    crate::dev::clear_cf_oauth_cache();
}

#[cfg(debug_assertions)]
pub fn hydrate_cf_oauth_session_dev_cache() {
    crate::dev::hydrate(&CF_OAUTH_SESSION);
}

/// Overlay the in-memory OAuth session onto credentials for UI / IPC responses.
pub fn apply_cf_oauth_session(creds: &mut StoredCredentials) {
    if let Some(session) = get_cf_oauth_session() {
        creds.cf_oauth_access_token = session.access_token.clone();
        creds.cf_oauth_refresh_token = session.refresh_token.clone();
        creds.cf_oauth_access_expires_at = session.access_expires_at.clone();
        creds.cf_oauth_account_id = session.account_id.clone();
        if !session.account_id.is_empty() {
            creds.account_id = session.account_id.clone();
        }
    }
    if creds.cf_oauth_refresh_token.trim().is_empty() {
        if let Ok(Some(keyring_blob)) = load_keyring_oauth_refresh() {
            creds.cf_oauth_refresh_token = keyring_blob.refresh_token;
            if !keyring_blob.account_id.is_empty() {
                creds.cf_oauth_account_id = keyring_blob.account_id.clone();
                if creds.account_id.is_empty() {
                    creds.account_id = keyring_blob.account_id;
                }
            }
        }
    }
}
